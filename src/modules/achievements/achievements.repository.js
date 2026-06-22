const BaseRepository = require('../../core/base/BaseRepository');

/**
 * AchievementsRepository - Camada de acesso a dados para o sistema de conquistas.
 */
class AchievementsRepository extends BaseRepository {
  constructor() {
    super('public.achievements');
  }

  /**
   * Busca todas as conquistas desbloqueadas por um usuário.
   * @param {string} userId - UUID do usuário.
   */
  async findUserAchievements(userId) {
    const query = `
      SELECT 
        a.*, 
        ua.unlocked_at 
      FROM public.achievements a
      JOIN public.user_achievements ua ON a.id = ua.achievement_id
      WHERE ua.user_id = $1
      ORDER BY ua.unlocked_at DESC
    `;
    const { rows } = await this.db.query(query, [userId]);
    return rows;
  }

  /**
   * Verifica se o usuário já possui uma conquista específica.
   * @param {string} userId 
   * @param {number} achievementId 
   */
  async hasAchievement(userId, achievementId) {
    const query = `
      SELECT 1 FROM public.user_achievements 
      WHERE user_id = $1 AND achievement_id = $2 
      LIMIT 1
    `;
    const { rows } = await this.db.query(query, [userId, achievementId]);
    return rows.length > 0;
  }

  /**
   * Registra o desbloqueio de uma conquista para o usuário.
   * @param {string} userId 
   * @param {number} achievementId 
   * @param {Object} client - Cliente de transação opcional
   */
  async grantToUser(userId, achievementId, client = null) {
    const query = `
      INSERT INTO public.user_achievements (user_id, achievement_id, unlocked_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT DO NOTHING
      RETURNING *
    `;
    const executor = client || this.db;
    const { rows } = await executor.query(query, [userId, achievementId]);
    return rows[0];
  }

  /**
   * Busca conquistas baseadas em um tipo de requisito específico.
   * Útil para o serviço de verificação automática.
   * @param {string} requirementType - EX: 'WIN_COUNT', 'XP_LEVEL'
   */
  async findByRequirementType(requirementType) {
    const query = `
      SELECT * FROM public.achievements 
      WHERE requirement_type = $1
    `;
    const { rows } = await this.db.query(query, [requirementType]);
    return rows;
  }

  /**
   * Obtém o progresso de conquistas de um usuário (ex: 5/20 conquistas).
   * @param {string} userId 
   */
  async getUserProgressStats(userId) {
    const query = `
      SELECT 
        (SELECT COUNT(*) FROM public.achievements) as total_available,
        (SELECT COUNT(*) FROM public.user_achievements WHERE user_id = $1) as total_unlocked
    `;
    const { rows } = await this.db.query(query, [userId]);
    return {
      totalAvailable: parseInt(rows[0].total_available),
      totalUnlocked: parseInt(rows[0].total_unlocked),
      percentage: rows[0].total_available > 0 
        ? Math.floor((rows[0].total_unlocked / rows[0].total_available) * 100) 
        : 0
    };
  }
}

module.exports = new AchievementsRepository();