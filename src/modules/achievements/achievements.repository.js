/**
 * 🏆 OTAKU CLASH ANGOLA - ACHIEVEMENTS REPOSITORY
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Gestão de persistência para o catálogo de conquistas e progresso dos jogadores.
 */

const BaseRepository = require('../../core/base/BaseRepository');
const logger = require('../../config/logger');

class AchievementsRepository extends BaseRepository {
  constructor() {
    super('public.achievements');
  }

  /**
   * 🔍 LISTA TODAS AS CONQUISTAS COM STATUS DO UTILIZADOR
   * Retorna o catálogo completo indicando quais o utilizador já desbloqueou.
   */
  async findAllWithUserStatus(userId) {
    const query = `
      SELECT 
        a.*, 
        ua.unlocked_at IS NOT NULL as "isUnlocked",
        ua.unlocked_at as "unlockedAt"
      FROM public.achievements a
      LEFT JOIN public.user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = $1
      ORDER BY a.category ASC, a.requirement_value ASC
    `;
    
    try {
      const { rows } = await this.db.query(query, [userId]);
      return rows;
    } catch (error) {
      logger.error(`[AchievementsRepo:findAllStatus] Erro: ${error.message}`);
      return [];
    }
  }

  /**
   * 🆔 BUSCA CONQUISTAS DESBLOQUEADAS POR UTILIZADOR
   */
  async findUserAchievements(userId) {
    const query = `
      SELECT a.*, ua.unlocked_at
      FROM public.achievements a
      JOIN public.user_achievements ua ON a.id = ua.achievement_id
      WHERE ua.user_id = $1
      ORDER BY ua.unlocked_at DESC
    `;
    
    try {
      const { rows } = await this.db.query(query, [userId]);
      return rows;
    } catch (error) {
      logger.error(`[AchievementsRepo:findUser] Erro: ${error.message}`);
      return [];
    }
  }

  /**
   * ✅ VERIFICA SE O UTILIZADOR JÁ POSSUI A CONQUISTA
   */
  async hasAchievement(userId, achievementId) {
    const query = `
      SELECT 1 FROM public.user_achievements 
      WHERE user_id = $1 AND achievement_id = $2 
      LIMIT 1
    `;
    try {
      const { rows } = await this.db.query(query, [userId, achievementId]);
      return rows.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * 🎖️ CONCEDE CONQUISTA AO UTILIZADOR (ATÔMICO)
   */
  async grantToUser(userId, achievementId, client = null) {
    const query = `
      INSERT INTO public.user_achievements (user_id, achievement_id, unlocked_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id, achievement_id) DO NOTHING
      RETURNING *
    `;
    
    try {
      const executor = client || this.db;
      const { rows } = await executor.query(query, [userId, achievementId]);
      return rows[0] || null;
    } catch (error) {
      logger.error(`[AchievementsRepo:grant] Falha: ${error.message}`);
      throw error;
    }
  }

  /**
   * ⚙️ BUSCA POR TIPO DE REQUISITO
   * Utilizado pelo service para verificar gatilhos de desbloqueio.
   * @param {string} type - 'WIN_COUNT', 'XP_LEVEL', 'MATCH_COUNT', etc.
   */
  async findByRequirementType(type) {
    const query = `SELECT * FROM ${this.tableName} WHERE requirement_type = $1`;
    try {
      const { rows } = await this.db.query(query, [type]);
      return rows;
    } catch (error) {
      return [];
    }
  }

  /**
   * 📊 ESTATÍSTICAS DE PROGRESSO (PLAYER)
   */
  async getPlayerProgress(userId) {
    const query = `
      SELECT 
        (SELECT COUNT(*) FROM public.achievements) as "totalAvailable",
        (SELECT COUNT(*) FROM public.user_achievements WHERE user_id = $1) as "totalUnlocked"
    `;
    
    try {
      const { rows } = await this.db.query(query, [userId]);
      const stats = rows[0];
      const total = parseInt(stats.totalAvailable || 0);
      const unlocked = parseInt(stats.totalUnlocked || 0);
      
      return {
        total,
        unlocked,
        percentage: total > 0 ? Math.floor((unlocked / total) * 100) : 0
      };
    } catch (error) {
      return { total: 0, unlocked: 0, percentage: 0 };
    }
  }
}

module.exports = new AchievementsRepository();