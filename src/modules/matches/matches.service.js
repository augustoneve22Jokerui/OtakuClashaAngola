const BaseService = require('../../core/base/BaseService');
const matchesRepository = require('./matches.repository');
const AppError = require('../../core/errors/AppError');
const logger = require('../../config/logger');
const XPCalculator = require('../../utils/XPCalculator');
const { MatchTypes } = require('../../core/constants/MatchTypes');

/**
 * MatchesService - Gerencia a lógica de negócio de partidas, duelos e recompensas.
 */
class MatchesService extends BaseService {
  constructor() {
    super(matchesRepository);
  }

  /**
   * Inicializa uma nova partida (Duelo ou Quick Play).
   * @param {Object} matchData - { type, entryFee, animeId, userId }
   */
  async initMatch(matchData) {
    const { type, entryFee, animeId, userId } = matchData;

    // 1. Verifica se o usuário já está em uma partida ativa
    const isInMatch = await this.repository.isUserInActiveMatch(userId);
    if (isInMatch) {
      throw AppError.badRequest('Você já possui uma partida em andamento.');
    }

    // 2. Se houver aposta, valida e reserva o saldo (lógica integrada no repository/service de wallet)
    // Aqui assumimos a criação da sala primeiro
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    return await this.executeInTransaction(async (client) => {
      const match = await this.repository.createMatch({
        type: type || MatchTypes.QUICK_PLAY,
        roomCode,
        entryFee: entryFee || 0,
        prizePool: (entryFee || 0) * 2 * 0.9, // 90% do total das entradas vai para o prêmio
        maxPlayers: 2,
        animeId
      }, client);

      // Adiciona o criador à partida
      await this.repository.addPlayer(match.id, userId, client);

      return match;
    });
  }

  /**
   * Entrar em uma partida existente via código de sala.
   */
  async joinByCode(userId, roomCode) {
    const match = await this.repository.findByRoomCode(roomCode);
    
    if (!match) {
      throw AppError.notFound('Sala não encontrada ou já iniciada.');
    }

    const playersCount = await this.repository.db.query(
      'SELECT COUNT(*) FROM public.match_players WHERE match_id = $1',
      [match.id]
    );

    if (parseInt(playersCount.rows[0].count) >= match.max_players) {
      throw AppError.badRequest('A sala já está cheia.');
    }

    await this.repository.addPlayer(match.id, userId);
    
    return await this.repository.findWithPlayers(match.id);
  }

  /**
   * Finaliza uma partida, processa o vencedor e distribui recompensas.
   */
  async finishAndReward(matchId, results) {
    // results: [{ userId: UUID, score: number, correctAnswers: number, avgTime: number }]
    
    return await this.executeInTransaction(async (client) => {
      const match = await this.repository.findById(matchId);
      if (!match || match.status === 'FINISHED') {
        throw AppError.badRequest('Partida inválida ou já finalizada.');
      }

      // 1. Determina o vencedor baseado no score
      const sortedResults = [...results].sort((a, b) => b.score - a.score);
      const winner = sortedResults[0];

      // 2. Atualiza status da partida e vencedor
      await this.repository.finishMatch(matchId, winner.userId, client);

      // 3. Processa recompensas para cada jogador
      for (const res of results) {
        const isWinner = res.userId === winner.userId;
        
        // Atualiza score no banco
        await this.repository.updatePlayerScore(matchId, res.userId, res.score, client);

        // Calcula XP ganho
        const earnedXP = XPCalculator.calculateMatchXP({
          correctAnswers: res.correctAnswers,
          totalQuestions: 10, // Padrão
          matchType: match.type,
          isWinner,
          avgResponseTime: res.avgTime
        });

        // Adiciona XP ao perfil (RPC/Function)
        await client.query('SELECT public.fn_add_user_xp($1, $2)', [res.userId, earnedXP]);

        // Se for o vencedor e houver prêmio em dinheiro
        if (isWinner && parseFloat(match.prize_pool) > 0) {
          await this.distributePrize(res.userId, match.prize_pool, matchId, client);
        }
      }

      logger.info(`[MatchesService] Partida ${matchId} finalizada com sucesso.`);
      return { matchId, winnerId: winner.userId };
    });
  }

  /**
   * Lógica interna para crédito de prêmio na carteira.
   */
  async distributePrize(userId, amount, matchId, client) {
    const walletQuery = `
      UPDATE public.wallets 
      SET balance_available = balance_available + $1 
      WHERE user_id = $2 
      RETURNING id
    `;
    const { rows: [wallet] } = await client.query(walletQuery, [amount, userId]);

    const transactionQuery = `
      INSERT INTO public.wallet_transactions (wallet_id, amount, direction, type, status, description)
      VALUES ($1, $2, 'CREDIT', 'MATCH_REWARD', 'COMPLETED', $3)
    `;
    await client.query(transactionQuery, [
      wallet.id, 
      amount, 
      `Prêmio da partida: ${matchId}`
    ]);
  }

  /**
   * Obtém o histórico de partidas formatado.
   */
  async getUserHistory(userId, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    return await this.repository.findUserHistory(userId, limit, offset);
  }
}

module.exports = new MatchesService();