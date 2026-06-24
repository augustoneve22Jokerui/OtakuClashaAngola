/**
 * 🎮 OTAKU CLASH ANGOLA - QUIZ REPOSITORY
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Gestão de estado volátil de sessões de quiz e persistência de resultados.
 */

const BaseRepository = require('../../core/base/BaseRepository');
const cacheProvider = require('../../config/hybridRedis');
const logger = require('../../config/logger');

class QuizRepository extends BaseRepository {
  constructor() {
    // Vinculado a match_players para registrar o desempenho individual final
    super('public.match_players');
    this.sessionPrefix = 'quiz:session:';
  }

  /**
   * ⚡ SALVA ESTADO DA SESSÃO NO CACHE (VOLÁTIL)
   * Armazena o progresso do utilizador durante o quiz.
   * @param {string} sessionId - UUID da partida/sessão.
   * @param {Object} sessionData - Dados do progresso (questões, acertos, tempo).
   * @param {number} ttl - Tempo de expiração (padrão 30 minutos).
   */
  async saveActiveSession(sessionId, sessionData, ttl = 1800) {
    const key = `${this.sessionPrefix}${sessionId}`;
    try {
      // No modo Fallback (NullRedisClient), o dado é salvo no Map interno
      await cacheProvider.client.set(key, JSON.stringify(sessionData), 'EX', ttl);
      return true;
    } catch (error) {
      logger.error(`[QuizRepo:SaveSession] Falha: ${error.message}`);
      return false;
    }
  }

  /**
   * 🔍 RECUPERA SESSÃO ATIVA
   */
  async getActiveSession(sessionId) {
    const key = `${this.sessionPrefix}${sessionId}`;
    try {
      const data = await cacheProvider.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error(`[QuizRepo:GetSession] Erro ao recuperar: ${error.message}`);
      return null;
    }
  }

  /**
   * 🧹 REMOVE SESSÃO DO CACHE
   * Executado ao finalizar ou abandonar a partida.
   */
  async deleteActiveSession(sessionId) {
    const key = `${this.sessionPrefix}${sessionId}`;
    try {
      await cacheProvider.client.del(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 📈 REGISTRA RESULTADO FINAL NO BANCO (PERSISTENTE)
   * @param {string} matchId 
   * @param {string} userId 
   * @param {Object} results - { score, position, reward_amount }
   */
  async saveMatchResult(matchId, userId, results, client = null) {
    const query = `
      INSERT INTO public.match_players (match_id, user_id, score, position, reward_amount, joined_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (match_id, user_id) DO UPDATE SET
        score = EXCLUDED.score,
        position = EXCLUDED.position,
        reward_amount = EXCLUDED.reward_amount
      RETURNING *
    `;

    const values = [
      matchId,
      userId,
      results.score || 0,
      results.position || 1,
      results.reward_amount || 0
    ];

    try {
      const executor = client || this.db;
      const { rows } = await executor.query(query, values);
      return rows[0];
    } catch (error) {
      logger.error(`[QuizRepo:SaveResult] Falha ao persistir no PostgreSQL: ${error.message}`);
      throw error;
    }
  }

  /**
   * 📑 BUSCA HISTÓRICO DE QUIZZES RECENTES DO UTILIZADOR
   */
  async getRecentUserQuizzes(userId, limit = 10) {
    const query = `
      SELECT 
        m.id as "sessionId",
        m.type as "mode",
        m.ended_at as "date",
        mp.score,
        COALESCE(a.title, 'Geral') as "animeTitle"
      FROM public.match_players mp
      JOIN public.matches m ON mp.match_id = m.id
      LEFT JOIN public.animes a ON m.anime_id = a.id
      WHERE mp.user_id = $1 AND m.status = 'FINISHED'
      ORDER BY m.ended_at DESC
      LIMIT $2
    `;
    
    try {
      const { rows } = await this.db.query(query, [userId, limit]);
      return rows;
    } catch (error) {
      return [];
    }
  }

  /**
   * 🛡️ VERIFICA SE JÁ EXISTE UMA SESSÃO EM ANDAMENTO
   */
  async findActiveMatchId(userId) {
    const query = `
      SELECT m.id 
      FROM public.matches m
      JOIN public.match_players mp ON m.id = mp.match_id
      WHERE mp.user_id = $1 AND m.status = 'IN_PROGRESS'
      LIMIT 1
    `;
    try {
      const { rows } = await this.db.query(query, [userId]);
      return rows.length > 0 ? rows[0].id : null;
    } catch (error) {
      return null;
    }
  }
}

module.exports = new QuizRepository();