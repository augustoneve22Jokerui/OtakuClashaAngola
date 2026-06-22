const BaseRepository = require('../../core/base/BaseRepository');
const cacheProvider = require('../../config/cache');

/**
 * QuizRepository - Camada de acesso a dados para sessões de quiz.
 * Utiliza o PostgreSQL para persistência de resultados e o Redis para estado volátil.
 */
class QuizRepository extends BaseRepository {
  constructor() {
    // Vinculado a match_players para registrar o desempenho individual
    super('public.match_players');
    this.sessionPrefix = 'quiz_session:';
  }

  /**
   * Armazena o estado de uma sessão ativa no cache (Redis).
   * @param {string} sessionId - UUID da sessão.
   * @param {Object} sessionData - Dados da sessão (questões, progresso, etc).
   * @param {number} ttl - Tempo de expiração em segundos (padrão 30 min).
   */
  async saveActiveSession(sessionId, sessionData, ttl = 1800) {
    const key = `${this.sessionPrefix}${sessionId}`;
    return await cacheProvider.set(key, sessionData, ttl);
  }

  /**
   * Recupera uma sessão ativa do cache.
   */
  async getActiveSession(sessionId) {
    const key = `${this.sessionPrefix}${sessionId}`;
    return await cacheProvider.get(key);
  }

  /**
   * Remove uma sessão do cache após conclusão ou abandono.
   */
  async deleteActiveSession(sessionId) {
    const key = `${this.sessionPrefix}${sessionId}`;
    return await cacheProvider.del(key);
  }

  /**
   * Registra a resposta de um usuário para fins de auditoria ou recuperação.
   * Salva no cache para não sobrecarregar o DB durante a partida.
   */
  async saveAnswerState(sessionId, questionId, answerData) {
    const key = `quiz_answers:${sessionId}:${questionId}`;
    return await cacheProvider.set(key, answerData, 3600);
  }

  /**
   * Busca estatísticas de desempenho do usuário em um anime específico.
   * @param {string} userId 
   * @param {number} animeId 
   */
  async getUserStatsByAnime(userId, animeId) {
    const query = `
      SELECT 
        COUNT(*) as total_quizzes,
        SUM(score) as total_score,
        AVG(score) as avg_score,
        MAX(score) as high_score
      FROM public.match_players mp
      JOIN public.matches m ON mp.match_id = m.id
      WHERE mp.user_id = $1 AND m.anime_id = $2 AND m.status = 'FINISHED'
    `;
    const { rows } = await this.db.query(query, [userId, animeId]);
    return rows[0];
  }

  /**
   * Busca o histórico recente de sessões concluídas do usuário.
   */
  async getRecentUserSessions(userId, limit = 10) {
    const query = `
      SELECT 
        m.id as session_id,
        m.type as mode,
        m.ended_at as date,
        mp.score,
        a.title as anime_title
      FROM public.match_players mp
      JOIN public.matches m ON mp.match_id = m.id
      LEFT JOIN public.animes a ON m.anime_id = a.id
      WHERE mp.user_id = $1 AND m.status = 'FINISHED'
      ORDER BY m.ended_at DESC
      LIMIT $2
    `;
    const { rows } = await this.db.query(query, [userId, limit]);
    return rows;
  }

  /**
   * Verifica se o usuário tem alguma sessão "presa" ou em andamento.
   */
  async hasPendingSession(userId) {
    const query = `
      SELECT m.id 
      FROM public.matches m
      JOIN public.match_players mp ON m.id = mp.match_id
      WHERE mp.user_id = $1 AND m.status = 'IN_PROGRESS'
      LIMIT 1
    `;
    const { rows } = await this.db.query(query, [userId]);
    return rows.length > 0 ? rows[0].id : null;
  }
}

module.exports = new QuizRepository();