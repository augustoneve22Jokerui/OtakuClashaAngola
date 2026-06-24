/**
 * ⚔️ OTAKU CLASH ANGOLA - BATTLE ROYALE SERVICE
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Orquestra a lógica de salas massivas, transações de entrada e premiação final.
 */

const BaseService = require('../../core/base/BaseService');
const AppError = require('../../core/errors/AppError');
const logger = require('../../config/logger');
const db = require('../../config/database');
const { MatchTypes } = require('../../core/constants/MatchTypes');
const { TransactionStatus } = require('../../core/constants/TransactionTypes');

class BattleRoyaleService extends BaseService {
  constructor() {
    // Battle Royale utiliza a tabela central de partidas (matches)
    super(null); 
  }

  /**
   * 🏗️ CRIA NOVA SALA DE BATTLE ROYALE (ADMIN/SISTEMA)
   */
  async createRoom(data) {
    const { title, anime_id, entry_fee, max_players } = data;
    const roomCode = this._generateRoomCode();

    const query = `
      INSERT INTO public.matches (
        type, room_code, entry_fee, max_players, status, anime_id, created_at
      )
      VALUES ($1, $2, $3, $4, 'WAITING', $5, NOW())
      RETURNING *
    `;

    try {
      const result = await db.query(query, [
        MatchTypes.BATTLE_ROYALE,
        roomCode,
        parseFloat(entry_fee || 0),
        parseInt(max_players || 100),
        anime_id
      ]);
      
      logger.info(`[BR:Service] Sala ${roomCode} criada com sucesso.`);
      return result.rows[0];
    } catch (error) {
      logger.error(`[BR:Service:Create] Falha: ${error.message}`);
      throw AppError.internal('Não foi possível inicializar a arena de Battle Royale.');
    }
  }

  /**
   * 🏃 PROCESSA ENTRADA DE JOGADOR COM DÉBITO ATÔMICO
   * Garante que o jogador só paga se houver vaga e a sala estiver aberta.
   */
  async joinBattleRoyale(userId, matchId) {
    return await this.executeInTransaction(async (client) => {
      // 1. Bloqueia o registro da partida para evitar estouro de vagas (Concurrency Lock)
      const matchQuery = `SELECT * FROM public.matches WHERE id = $1 FOR UPDATE`;
      const { rows: [match] } = await client.query(matchQuery, [matchId]);

      if (!match) throw AppError.notFound('Arena de Battle Royale não encontrada.');
      if (match.status !== 'WAITING') throw AppError.badRequest('As inscrições para esta arena já foram encerradas.');

      // 2. Verifica contagem atual de jogadores
      const countQuery = `SELECT COUNT(*) FROM public.match_players WHERE match_id = $1`;
      const { rows: [{ count }] } = await client.query(countQuery, [matchId]);

      if (parseInt(count) >= match.max_players) {
        throw AppError.badRequest('A arena atingiu o limite máximo de participantes.');
      }

      // 3. Verifica se o jogador já está inscrito
      const checkPlayerQuery = `SELECT 1 FROM public.match_players WHERE match_id = $1 AND user_id = $2`;
      const { rows: existingPlayer } = await client.query(checkPlayerQuery, [matchId, userId]);
      if (existingPlayer.length > 0) throw AppError.conflict('Você já está inscrito nesta arena.');

      // 4. Processa Taxa de Entrada (Entry Fee)
      if (parseFloat(match.entry_fee) > 0) {
        const walletQuery = `SELECT id, balance_available FROM public.wallets WHERE user_id = $1 FOR UPDATE`;
        const { rows: [wallet] } = await client.query(walletQuery, [userId]);

        if (!wallet || parseFloat(wallet.balance_available) < parseFloat(match.entry_fee)) {
          throw AppError.badRequest('Saldo insuficiente para pagar a taxa de entrada da arena.');
        }

        // Deduz saldo disponível
        await client.query(
          'UPDATE public.wallets SET balance_available = balance_available - $1, updated_at = NOW() WHERE id = $2',
          [match.entry_fee, wallet.id]
        );

        // Registra transação financeira
        await client.query(
          `INSERT INTO public.wallet_transactions (wallet_id, amount, direction, type, status, description, reference_id)
           VALUES ($1, $2, 'DEBIT', 'MATCH_ENTRY', $3, $4, $5)`,
          [wallet.id, match.entry_fee, TransactionStatus.COMPLETED, `Entrada Arena BR: ${match.room_code}`, match.id]
        );
      }

      // 5. Adiciona utilizador à lista de competidores
      await client.query(
        'INSERT INTO public.match_players (match_id, user_id, joined_at) VALUES ($1, $2, NOW())',
        [matchId, userId]
      );

      // 6. Atualiza Prize Pool da partida (Opcional: 90% das taxas vão para o prêmio)
      if (parseFloat(match.entry_fee) > 0) {
        await client.query(
          'UPDATE public.matches SET prize_pool = prize_pool + ($1 * 0.9) WHERE id = $2',
          [match.entry_fee, matchId]
        );
      }

      logger.info(`[BR:Join] Utilizador ${userId} confirmado na arena ${match.room_code}`);
      
      return { matchId, roomCode: match.room_code };
    });
  }

  /**
   * 🏆 FINALIZA ARENA E DISTRIBUI RECOMPENSAS
   * Chama a função RPC do PostgreSQL para garantir atomicidade total.
   */
  async finalizeBattleRoyale(matchId, winnerId) {
    try {
      // 1. Busca detalhes finais para log
      const { rows: [match] } = await db.query('SELECT * FROM public.matches WHERE id = $1', [matchId]);
      
      if (!match) throw new Error('Partida para finalização não encontrada.');

      const rewardAmount = parseFloat(match.prize_pool || 0);
      const xpAmount = 500; // XP Base por vencer uma arena massiva

      // 2. Executa a função PL/pgSQL que gerencia:
      // - Update da partida (Winner, Status, EndedAt)
      // - Update do player (Reward amount)
      // - Crédito na carteira do vencedor
      // - Registro da transação de crédito
      // - Adição de XP e Level Up automático
      const { rows: [result] } = await db.query(
        'SELECT public.fn_process_match_rewards($1, $2, $3, $4) as success',
        [matchId, winnerId, rewardAmount, xpAmount]
      );

      if (result.success) {
        logger.info(`[BR:Finalize] Arena ${match.room_code} encerrada. Vencedor: ${winnerId} | Prêmio: ${rewardAmount} AKZ`);
        return true;
      } else {
        throw new Error('A função de recompensa do banco de dados retornou falha.');
      }

    } catch (error) {
      logger.error(`[BR:Service:Finalize] Erro crítico: ${error.message}`);
      // Em produção, isso dispararia um alerta para intervenção manual da STAFF
      throw error;
    }
  }

  /**
   * 🎲 GERA CÓDIGO DE SALA ÚNICO (PRIVATE)
   */
  _generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sem O, 0, I, 1 para evitar confusão
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * 🛡️ EXECUTA LÓGICA EM TRANSAÇÃO (HELPER)
   */
  async executeInTransaction(work) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = new BattleRoyaleService();