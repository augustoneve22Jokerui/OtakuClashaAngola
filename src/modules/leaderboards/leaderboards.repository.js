/**
 * 🏆 OTAKU CLASH ANGOLA - LEADERBOARDS REPOSITORY
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Camada de persistência especializada em cálculos de ranking e performance competitiva.
 */

const BaseRepository = require('../../core/base/BaseRepository');
const logger = require('../../config/logger');

class LeaderboardsRepository extends BaseRepository {
  constructor() {
    // Atua primariamente sobre a tabela de perfis
    super('public.profiles');
  }

  /**
   * 🌍 RANKING GLOBAL DE XP
   * Ordena utilizadores por nível e XP total acumulado.
   */
  async getGlobalLeaderboard(limit = 50, offset = 0) {
    const query = `
      SELECT 
        id, 
        username, 
        avatar_url as "avatarUrl", 
        level, 
        xp,
        RANK() OVER (ORDER BY xp DESC, level DESC) as position
      FROM public.profiles
      WHERE role != 'ADMIN'
      ORDER BY xp DESC, level DESC
      LIMIT $1 OFFSET $2
    `;
    
    try {
      const { rows } = await this.db.query(query, [limit, offset]);
      return rows;
    } catch (error) {
      logger.error(`[LeaderboardsRepo:Global] Erro: ${error.message}`);
      return [];
    }
  }

  /**
   * 📅 RANKING PERIÓDICO (DIÁRIO / SEMANAL / MENSAL)
   * Baseia-se no XP ganho em partidas dentro do intervalo solicitado.
   * @param {string} interval - '1 day', '7 days' ou '30 days'
   */
  async getLeaderboardByPeriod(interval = '7 days', limit = 50) {
    const query = `
      SELECT 
        p.id, 
        p.username, 
        p.avatar_url as "avatarUrl", 
        p.level,
        SUM(mp.score) as "periodXp",
        RANK() OVER (ORDER BY SUM(mp.score) DESC) as position
      FROM public.profiles p
      JOIN public.match_players mp ON p.id = mp.user_id
      JOIN public.matches m ON mp.match_id = m.id
      WHERE m.ended_at >= NOW() - INTERVAL '${interval}'
      AND m.status = 'FINISHED'
      AND p.role != 'ADMIN'
      GROUP BY p.id
      ORDER BY "periodXp" DESC
      LIMIT $1
    `;
    
    try {
      const { rows } = await this.db.query(query, [limit]);
      return rows;
    } catch (error) {
      logger.error(`[LeaderboardsRepo:Period] Erro no intervalo ${interval}: ${error.message}`);
      return [];
    }
  }

  /**
   * 🛡️ ELITE DE CLÃS (GUILD RANKING)
   * Ordena guildas por nível e prestígio.
   */
  async getGuildLeaderboard(limit = 20) {
    const query = `
      SELECT 
        id, 
        name, 
        tag, 
        logo_url as "logoUrl", 
        level, 
        xp, 
        member_count as "memberCount",
        RANK() OVER (ORDER BY xp DESC, level DESC) as position
      FROM public.guilds
      ORDER BY xp DESC, level DESC
      LIMIT $1
    `;
    
    try {
      const { rows } = await this.db.query(query, [limit]);
      return rows;
    } catch (error) {
      logger.error(`[LeaderboardsRepo:Guilds] Erro: ${error.message}`);
      return [];
    }
  }

  /**
   * 🆔 POSIÇÃO ATUAL DO UTILIZADOR
   * Localiza o utilizador no ranking global de forma eficiente.
   */
  async getUserRankPosition(userId) {
    const query = `
      WITH ranked_users AS (
        SELECT 
          id, 
          username, 
          avatar_url as "avatarUrl", 
          level, 
          xp,
          RANK() OVER (ORDER BY xp DESC, level DESC) as position
        FROM public.profiles
        WHERE role != 'ADMIN'
      )
      SELECT * FROM ranked_users WHERE id = $1
    `;
    
    try {
      const { rows } = await this.db.query(query, [userId]);
      return rows[0] || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 🔥 ESPECIALISTAS POR ANIME
   * Ranking de quem mais pontuou em uma obra específica.
   */
  async getLeaderboardByAnime(animeId, limit = 50) {
    const query = `
      SELECT 
        p.id, 
        p.username, 
        p.avatar_url as "avatarUrl",
        SUM(mp.score) as "animeXp",
        RANK() OVER (ORDER BY SUM(mp.score) DESC) as position
      FROM public.profiles p
      JOIN public.match_players mp ON p.id = mp.user_id
      JOIN public.matches m ON mp.match_id = m.id
      WHERE m.anime_id = $1 
      AND m.status = 'FINISHED'
      GROUP BY p.id
      ORDER BY "animeXp" DESC
      LIMIT $2
    `;
    
    try {
      const { rows } = await this.db.query(query, [animeId, limit]);
      return rows;
    } catch (error) {
      logger.error(`[LeaderboardsRepo:Anime] Erro para Anime ${animeId}: ${error.message}`);
      return [];
    }
  }
}

module.exports = new LeaderboardsRepository();