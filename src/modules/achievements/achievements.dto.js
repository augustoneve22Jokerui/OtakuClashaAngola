/**
 * AchievementsDTO - Responsável por formatar a saída dos dados de conquistas.
 */
class AchievementsDTO {
  /**
   * Formata uma única conquista para resposta da API.
   * @param {Object} achievement - Dados brutos do banco.
   * @param {boolean} isUnlocked - Status de desbloqueio do usuário.
   */
  static transform(achievement, isUnlocked = false) {
    if (!achievement) return null;

    return {
      id: achievement.id,
      name: achievement.name,
      description: achievement.description,
      category: achievement.category,
      requirement: {
        type: achievement.requirement_type,
        value: achievement.requirement_value,
      },
      rewards: {
        xp: parseInt(achievement.reward_xp),
        coins: parseFloat(achievement.reward_coins).toFixed(2),
        currency: 'AKZ'
      },
      badgeUrl: achievement.badge_url,
      isUnlocked: isUnlocked || !!achievement.unlocked_at,
      unlockedAt: achievement.unlocked_at || null,
      createdAt: achievement.created_at
    };
  }

  /**
   * Formata uma lista de conquistas.
   * @param {Array} achievements 
   */
  static transformMany(achievements) {
    if (!achievements || !Array.isArray(achievements)) return [];
    return achievements.map(item => this.transform(item));
  }

  /**
   * Formata o progresso de conquistas para o perfil.
   * @param {Object} stats 
   */
  static transformStats(stats) {
    return {
      total: stats.totalAvailable,
      unlocked: stats.totalUnlocked,
      percentage: stats.percentage,
      remaining: stats.totalAvailable - stats.totalUnlocked
    };
  }
}

module.exports = AchievementsDTO;