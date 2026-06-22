const BaseService = require('../../core/base/BaseService');
const AppError = require('../../core/errors/AppError');
const logger = require('../../config/logger');
const db = require('../../config/database');
const { MatchTypes } = require('../../core/constants/MatchTypes');
const socketServer = require('../../socket/SocketServer');

/**
 * BattleRoyaleService - Lógica de negócio para o modo de jogo Battle Royale.
 * Orquestra salas de grande escala e eliminação progressiva.
 */
class BattleRoyaleService extends BaseService {
  constructor() {
    // Note: Utiliza a tabela de matches com filtro para BATTLE_ROYALE
    super(null); 
  }

  /**
   * Cria uma nova sala de Battle Royale (Geralmente via Admin ou sistema agendado).
   */
  async createRoom(data) {
    const { title, anime_id, entry_fee, max_players } = data;

    return await db.query(
      `INSERT INTO public.matches (type, room_code, entry_fee, max_players, status, created_at)
       VALUES ($1, $2, $3, $4, 'WAITING', NOW())
       RETURNING *`,
      [MatchTypes.BATTLE_ROYALE, this.generateRoomCode(), entry_fee, max_players]
    );
  }

  /**
   * Processa a entrada de um jogador em uma sala de Battle Royale.
   * Valida saldo e status da sala.
   */
  async joinBattleRoyale(userId, matchId) {
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // 1. Busca detalhes da partida e trava para atualização
      const { rows: [match] } = await client.query(
        'SELECT * FROM public.matches WHERE id = $1 AND type = $2 FOR UPDATE',
        [matchId, MatchTypes.BATTLE_ROYALE]
      );

      if (!match) throw AppError.notFound('Sala de Battle Royale não encontrada.');
      if (match.status !== 'WAITING') throw AppError.badRequest('A partida já iniciou ou foi encerrada.');

      // 2. Verifica se a sala está cheia
      const { rows: [{ count }] } = await client.query(
        'SELECT COUNT(*) FROM public.match_players WHERE match_id = $1',
        [matchId]
      );

      if (parseInt(count) >= match.max_players) {
        throw AppError.badRequest('A sala atingiu o limite máximo de jogadores.');
      }

      // 3. Processa taxa de entrada se houver
      if (parseFloat(match.entry_fee) > 0) {
        const { rows: [wallet] } = await client.query(
          'SELECT balance_available FROM public.wallets WHERE user_id = $1 FOR UPDATE',
          [userId]
        );

        if (parseFloat(wallet.balance_available) < parseFloat(match.entry_fee)) {
          throw AppError.badRequest('Saldo insuficiente para entrar nesta partida.');
        }

        // Deduz saldo
        await client.query(
          'UPDATE public.wallets SET balance_available = balance_available - $1 WHERE user_id = $2',
          [match.entry_fee, userId]
        );

        // Registra transação
        await client.query(
          `INSERT INTO public.wallet_transactions (wallet_id, amount, direction, type, status, description)
           SELECT id, $1, 'DEBIT', 'MATCH_ENTRY', 'COMPLETED', $2
           FROM public.wallets WHERE user_id = $3`,
          [match.entry_fee, `Entrada no Battle Royale: ${match.room_code}`, userId]
        );
      }

      // 4. Adiciona jogador à partida
      await client.query(
        'INSERT INTO public.match_players (match_id, user_id, joined_at) VALUES ($1, $2, NOW())',
        [matchId, userId]
      );

      await client.query('COMMIT');

      logger.info(`[BattleRoyaleService] Usuário ${userId} entrou na sala ${matchId}`);
      
      return { matchId, roomCode: match.room_code };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`[BattleRoyaleService] Erro ao entrar na sala: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Finaliza a partida e distribui as recompensas.
   */
  async finalizeBattleRoyale(matchId, winnerId) {
    try {
      const { rows: [match] } = await db.query(
        'SELECT * FROM public.matches WHERE id = $1',
        [matchId]
      );

      const totalPrize = parseFloat(match.entry_fee) * match.max_players * 0.9; // 90% para o vencedor
      const xpReward = 500; // XP base por vitória em BR

      // Chama a função atômica do PostgreSQL para processar prêmios
      const result = await db.query(
        'SELECT public.fn_process_match_rewards($1, $2, $3, $4)',
        [matchId, winnerId, totalPrize, xpReward]
      );

      logger.info(`[BattleRoyaleService] Partida ${matchId} finalizada. Vencedor: ${winnerId}`);
      
      return result.rows[0];
    } catch (error) {
      logger.error(`[BattleRoyaleService] Erro ao finalizar BR: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gera um código de sala único de 6 caracteres.
   */
  generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
}

module.exports = new BattleRoyaleService();