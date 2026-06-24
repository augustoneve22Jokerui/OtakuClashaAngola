/**
 * 👤 OTAKU CLASH ANGOLA - PROFILES REPOSITORY
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Gestão de persistência para perfis sociais e estatísticas de jogadores.
 */

const BaseRepository = require('../../core/base/BaseRepository');
const logger = require('../../config/logger');

class ProfilesRepository extends BaseRepository {
  constructor() {
    super('public.profiles');
  }

  /**
   * 🔍 BUSCA PERFIL DETALHADO POR ID
   * Inclui contagem de vitórias e conquistas para o Utilizador.
   */
  async findByUserId(userId) {
    const query = `
      SELECT 
        p.*, 
        au.email,
        (SELECT COUNT(*) FROM public.user_achievements WHERE user_id = p.id) as "achievementsCount",
        (SELECT COUNT(*) FROM public.match_players WHERE user_id = p.id AND position = 1) as "winsCount",
        (SELECT g.name FROM public.guilds g JOIN public.guild_members gm ON g.id = gm.guild_id WHERE gm.user_id = p.id LIMIT 1) as "guildName"
      FROM public.profiles p
      JOIN auth.users au ON p.id = au.id
      WHERE p.id = $1
      LIMIT 1
    `;
    
    try {
      const { rows } = await this.db.query(query, [userId]);
      return rows[0] || null;
    } catch (error) {
      logger.error(`[ProfilesRepo:findByUserId] Erro: ${error.message}`);
      return null;
    }
  }

  /**
   * 📊 OBTÉM ESTATÍSTICAS COMPETITIVAS COMPLETAS
   */
  async getProfileStats(userId) {
    const query = `
      SELECT 
        COUNT(*) as "totalMatches",
        COUNT(*) FILTER (WHERE position = 1) as "victories",
        COALESCE(SUM(score), 0) as "totalScore",
        (SELECT COUNT(*) FROM public.user_achievements WHERE user_id = $1) as "achievements",
        COALESCE(
          (SELECT name FROM public.guilds g 
           JOIN public.guild_members gm ON g.id = gm.guild_id 
           WHERE gm.user_id = $1 LIMIT 1), 
          'Sem Guilda'
        ) as "guildName"
      FROM public.match_players
      WHERE user_id = $1
    `;
    
    try {
      const { rows } = await this.db.query(query, [userId]);
      const stats = rows[0];

      // Cálculo de Win Rate em nível de query ou JS
      const total = parseInt(stats.totalMatches || 0);
      const wins = parseInt(stats.victories || 0);
      const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0";

      return {
        ...stats,
        totalMatches: total,
        victories: wins,
        totalScore: parseInt(stats.totalScore),
        achievementsCount: parseInt(stats.achievements),
        winRate: winRate
      };
    } catch (error) {
      logger.error(`[ProfilesRepo:getStats] Falha: ${error.message}`);
      return { totalMatches: 0, victories: 0, totalScore: 0, winRate: "0.0" };
    }
  }

  /**
   * 🔎 BUSCA TEXTUAL DE PERFIS (AUTOCOMPLETE / DESCOBERTA)
   */
  async searchProfiles(term, limit = 10) {
    const query = `
      SELECT id, username, avatar_url, level, xp, is_online
      FROM ${this.tableName}
      WHERE username ILIKE $1
      ORDER BY level DESC, xp DESC
      LIMIT $2
    `;
    
    try {
      const { rows } = await this.db.query(query, [`%${term}%`, limit]);
      return rows;
    } catch (error) {
      logger.error(`[ProfilesRepo:search] Erro: ${error.message}`);
      return [];
    }
  }

  /**
   * 📡 ATUALIZA PRESENÇA (ONLINE/OFFLINE)
   */
  async updatePresence(userId, isOnline) {
    const query = `
      UPDATE ${this.tableName} 
      SET 
        is_online = $1, 
        last_seen = NOW(),
        updated_at = NOW()
      WHERE id = $2
    `;
    
    try {
      await this.db.query(query, [isOnline, userId]);
      return true;
    } catch (error) {
      logger.error(`[ProfilesRepo:Presence] Falha ao atualizar ${userId}: ${error.message}`);
      return false;
    }
  }

  /**
   * 🖼️ ATUALIZA AVATAR E DADOS BÁSICOS
   */
  async updateProfileData(userId, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    
    const setClause = keys
      .map((key, i) => `${key} = $${i + 1}`)
      .join(', ');

    const query = `
      UPDATE ${this.tableName}
      SET ${setClause}, updated_at = NOW()
      WHERE id = $${keys.length + 1}
      RETURNING *
    `;

    try {
      const { rows } = await this.db.query(query, [...values, userId]);
      return rows[0];
    } catch (error) {
      logger.error(`[ProfilesRepo:Update] Erro: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new ProfilesRepository();