const BaseRepository = require('../../core/base/BaseRepository');

/**
 * LeaderboardsRepository - Camada de acesso a dados para rankings e classificações competitivas.
 */
class LeaderboardsRepository extends BaseRepository {
  constructor() {
    super('public.profiles');
  }

  /**
   * Obtém o ranking global de XP.
   * @param {Object} params - { limit, offset }
   */
  async getGlobalLeaderboard(limit = 50, offset = 0) {
    const query = `
      SELECT 
        id, username, avatar_url, level, xp,
        RANK() OVER (ORDER BY xp DESC) as position
      FROM public.profiles
      ORDER BY xp DESC
      LIMIT $1 OFFSET $2
    `;
    const { rows } = await this.db.query(query, [limit, offset]);
    return rows;
  }

  /**
   * Obtém ranking baseado em XP ganho num período específico.
   * Útil para rankings Diários, Semanais e Mensais.
   * @param {string} interval - '1 day', '7 days', '30 days'
   */
  async getLeaderboardByPeriod(interval = '7 days', limit = 50) {
    // Esta query assume que existe uma tabela de log de XP ou usa match_players como base
    const query = `
      SELECT 
        p.id, p.username, p.avatar_url, p.level,
        SUM(mp.score) as period_xp,
        RANK() OVER (ORDER BY SUM(mp.score) DESC) as position
      FROM public.profiles p
      JOIN public.match_players mp ON p.id = mp.user_id
      JOIN public.matches m ON mp.match_id = m.id
      WHERE m.ended_at >= NOW() - INTERVAL '${interval}'
      GROUP BY p.id
      ORDER BY period_xp DESC
      LIMIT $1
    `;
    const { rows } = await this.db.query(query, [limit]);
    return rows;
  }

  /**
   * Obtém o ranking de Clãs (Guildas) baseado em XP/Nível.
   */
  async getGuildLeaderboard(limit = 20) {
    const query = `
      SELECT 
        id, name, tag, logo_url, level, xp, member_count,
        RANK() OVER (ORDER BY xp DESC, level DESC) as position
      FROM public.guilds
      ORDER BY xp DESC, level DESC
      LIMIT $1
    `;
    const { rows } = await this.db.query(query, [limit]);
    return rows;
  }

  /**
   * Busca a posição e dados de ranking de um usuário específico.
   */
  async getUserRankPosition(userId) {
    const query = `
      WITH ranked_users AS (
        SELECT 
          id, username, avatar_url, level, xp,
          RANK() OVER (ORDER BY xp DESC) as position
        FROM public.profiles
      )
      SELECT * FROM ranked_users WHERE id = $1
    `;
    const { rows } = await this.db.query(query, [userId]);
    return rows[0] || null;
  }

  /**
   * Ranking por categoria de Anime específica.
   */
  async getLeaderboardByAnime(animeId, limit = 50) {
    const query = `
      SELECT 
        p.id, p.username, p.avatar_url,
        SUM(mp.score) as anime_xp,
        RANK() OVER (ORDER BY SUM(mp.score) DESC) as position
      FROM public.profiles p
      JOIN public.match_players mp ON p.id = mp.user_id
      JOIN public.matches m ON mp.match_id = m.id
      WHERE m.anime_id = $1 AND m.status = 'FINISHED'
      GROUP BY p.id
      ORDER BY anime_xp DESC
      LIMIT $2
    `;
    const { rows } = await this.db.query(query, [animeId, limit]);
    return rows;
  }
}

module.exports = new LeaderboardsRepository();