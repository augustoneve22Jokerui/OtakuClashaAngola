/**
 * ProfilesDTO - Responsável pela transformação e formatação de dados de perfis.
 */
class ProfilesDTO {
  /**
   * Transforma um perfil para resposta da API.
   * @param {Object} profile - Dados brutos do banco.
   * @param {boolean} isOwner - Define se os dados sensíveis devem ser exibidos.
   */
  static transform(profile, isOwner = false) {
    if (!profile) return null;

    const data = {
      id: profile.id,
      username: profile.username,
      fullName: profile.full_name || null,
      avatarUrl: profile.avatar_url || null,
      level: parseInt(profile.level || 1),
      xp: parseInt(profile.xp || 0),
      isOnline: !!profile.is_online,
      lastSeen: profile.last_seen,
    };

    // Adiciona estatísticas se presentes no objeto original
    if (profile.stats) {
      data.statistics = {
        totalMatches: parseInt(profile.stats.totalMatches || 0),
        victories: parseInt(profile.stats.victories || 0),
        winRate: profile.stats.winRate || "0.0",
        totalScore: parseInt(profile.stats.totalScore || 0),
        achievementsCount: parseInt(profile.stats.achievementsCount || 0),
        guildName: profile.stats.guildName || null
      };
    }

    // Dados privados apenas para o dono
    if (isOwner) {
      data.email = profile.email; // O e-mail geralmente vem do join com auth.users
      data.createdAt = profile.created_at;
      data.updatedAt = profile.updated_at;
    }

    return data;
  }

  /**
   * Transforma uma lista de perfis simplificados (usado em buscas).
   * @param {Array} profiles 
   */
  static transformMany(profiles) {
    if (!profiles || !Array.isArray(profiles)) return [];
    return profiles.map(profile => ({
      id: profile.id,
      username: profile.username,
      avatarUrl: profile.avatar_url,
      level: parseInt(profile.level || 1),
      xp: parseInt(profile.xp || 0)
    }));
  }

  /**
   * Formata as estatísticas de forma isolada.
   */
  static transformStats(stats) {
    if (!stats) return null;

    return {
      matches: stats.totalMatches,
      wins: stats.victories,
      winRate: `${stats.winRate}%`,
      achievements: stats.achievementsCount,
      rankInfo: {
        currentLevel: stats.level,
        currentXP: stats.xp
      }
    };
  }
}

module.exports = ProfilesDTO;