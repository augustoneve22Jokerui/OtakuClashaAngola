/**
 * 🎮 OTAKU CLASH ANGOLA - MATCHES SERVICE
 * Versão: 2.0.0 - Enterprise Grade (Transactional)
 * Descrição: Orquestra a criação, progresso e finalização de partidas com recompensas.
 */

const BaseService = require('../../core/base/BaseService');
const matchesRepository = require('./matches.repository');
const walletsService = require('../wallets/wallets.service');
const XPCalculator = require('../../utils/XPCalculator');
const AppError = require('../../core/errors/AppError');
const logger = require('../../config/logger');
const { MatchTypes } = require('../../core/constants/MatchTypes');

class MatchesService extends BaseService {
  constructor() {
    super(matchesRepository);
  }

  /**
   * 🏗️ INICIALIZA UMA NOVA PARTIDA
   * @param {Object} data - { userId, type, entryFee, animeId, maxPlayers }
   */
  async initMatch(data) {
    const { userId, type, entryFee = 0, animeId, maxPlayers = 2 } = data;

    // 1. Gera código de sala único de 6 caracteres
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    return await this.executeInTransaction(async (client) => {
      // 2. Cria o registro da partida
      const match = await this.repository.createMatch({
        type: type || MatchTypes.QUICK_PLAY,
        roomCode,
        entryFee,
        prizePool: entryFee * maxPlayers * 0.9, // 90% das taxas formam o prêmio
        maxPlayers,
        animeId
      }, client);

      // 3. Adiciona o criador como o primeiro jogador
      await this.repository.addPlayer(match.id, userId, client);

      logger.info(`[Matches:Init] Partida ${match.id} iniciada pelo utilizador ${userId}`);
      return match;
    });
  }

  /**
   * 🏆 FINALIZA PARTIDA E DISTRIBUI RECOMPENSAS (CRÍTICO)
   * Processa scores, define vencedor, credita coins e XP.
   * @param {string} matchId 
   * @param {Array} results - [{ userId, score, correctAnswers, avgTime }]
   */
  async finishAndReward(matchId, results) {
    if (!results || results.length === 0) {
      throw AppError.badRequest('Resultados da partida não fornecidos.');
    }

    return await this.executeInTransaction(async (client) => {
      // 1. Busca detalhes da partida com trava de atualização
      const match = await this.repository.findById(matchId);
      if (!match || match.status === 'FINISHED') {
        throw AppError.badRequest('Partida inválida ou já encerrada.');
      }

      // 2. Determina o vencedor (Maior score)
      const sortedResults = [...results].sort((a, b) => b.score - a.score);
      const winner = sortedResults[0];

      // 3. Atualiza status da partida e define vencedor no DB
      await this.repository.finishMatch(matchId, winner.userId, client);

      // 4. Processa recompensas para cada participante
      for (const playerRes of results) {
        const isWinner = playerRes.userId === winner.userId;

        // A. Atualiza score final do jogador na tabela de junção
        await this.repository.updatePlayerScore(matchId, playerRes.userId, playerRes.score, client);

        // B. Calcula XP ganho via motor de regras
        const earnedXP = XPCalculator.calculateMatchXP({
          correctAnswers: playerRes.correctAnswers,
          totalQuestions: 10, // Padrão do sistema
          matchType: match.type,
          isWinner,
          avgResponseTime: playerRes.avgTime
        });

        // C. Credita XP e processa Level Up via RPC no PostgreSQL
        await client.query('SELECT public.fn_add_user_xp($1, $2)', [playerRes.userId, earnedXP]);

        // D. Distribui prêmio em moedas (Coins) apenas se houver prize pool e for o vencedor
        if (isWinner && parseFloat(match.prize_pool) > 0) {
          await walletsService.credit(
            playerRes.userId,
            parseFloat(match.prize_pool),
            'MATCH_REWARD',
            `Vitória na partida: ${match.room_code}`,
            { matchId: match.id },
            client
          );
        }
      }

      logger.info(`[Matches:Reward] Partida ${matchId} finalizada. Vencedor: ${winner.userId}`);
      
      return {
        matchId,
        winnerId: winner.userId,
        status: 'FINISHED'
      };
    });
  }

  /**
   * 📄 OBTÉM HISTÓRICO PAGINADO
   */
  async getUserHistory(userId, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    const items = await this.repository.findUserHistory(userId, limit, offset);
    return items;
  }

  /**
   * 🕵️ MONITORIA DE ARENA (ADMIN)
   */
  async getLiveMatches() {
    try {
      return await this.repository.findActiveMatches(50);
    } catch (error) {
      logger.error(`[MatchesService:Live] Erro: ${error.message}`);
      return [];
    }
  }

  /**
   * 🛑 ABORTAR PARTIDA (ADMIN/SISTEMA)
   */
  async abortMatch(matchId, reason = 'Interrupção Administrativa') {
    return await this.executeInTransaction(async (client) => {
      const match = await this.repository.findById(matchId);
      if (!match || match.status === 'FINISHED') return null;

      // Atualiza para finalizada sem vencedor
      const updated = await this.repository.update(matchId, {
        status: 'FINISHED',
        ended_at: new Date(),
        winner_id: null
      }, client);

      logger.warn(`[Matches:Abort] Partida ${matchId} abortada. Motivo: ${reason}`);
      return updated;
    });
  }
}

module.exports = new MatchesService();