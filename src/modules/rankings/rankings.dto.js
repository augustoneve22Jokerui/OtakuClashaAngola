/**
 * RankingsDTO - Responsável pela transformação de dados do sistema competitivo de Tiers e LP.
 */
class RankingsDTO {
  /**
   * Transforma o perfil competitivo individual de um usuário.
   * @param {Object} profile - Dados processados pelo service.
   */
  static transformProfile(profile) {
    if (!profile) return null;

    return {
      user: {
        id: profile.userId,
        username: profile.username,
        avatarUrl: profile.avatarUrl
      },
      competitive: {
        lp: parseInt(profile.lp || 0),
        tier: profile.tier,
        tierColor: profile.tierColor,
        globalPosition: parseInt(profile.globalPosition || 0)
      },
      progression: {
        nextTier: profile.nextTier ? {
          name: profile.nextTier.name,
          minLP: profile.nextTier.minLP,
          pointsNeeded: profile.nextTier.minLP - (profile.lp || 0)
        } : null,
        isMaxTier: !profile.nextTier
      }
    };
  }

  /**
   * Transforma um registro de jogador na lista de Top Players.
   * @param {Object} player - Registro do banco de dados/cache.
   */
  static transformRankedPlayer(player) {
    if (!player) return null;

    return {
      position: parseInt(player.position || player.rank_position),
      id: player.id,
      username: player.username,
      avatarUrl: player.avatar_url,
      level: parseInt(player.level || 1),
      lp: parseInt(player.lp || 0),
      tier: player.tier || 'UNRANKED'
    };
  }

  /**
   * Transforma uma lista de jogadores ranqueados.
   * @param {Array} players 
   */
  static transformMany(players) {
    if (!players || !Array.isArray(players)) return [];
    return players.map(player => this.transformRankedPlayer(player));
  }

  /**
   * Formata os dados de distribuição de jogadores por Tier para gráficos.
   * @param {Array} distribution 
   */
  static transformDistribution(distribution) {
    if (!distribution || !Array.isArray(distribution)) return [];
    
    const totalPlayers = distribution.reduce((sum, item) => sum + parseInt(item.player_count), 0);

    return distribution.map(item => ({
      tier: item.tier,
      count: parseInt(item.player_count),
      percentage: totalPlayers > 0 
        ? ((parseInt(item.player_count) / totalPlayers) * 100).toFixed(1) + '%' 
        : '0%'
    }));
  }
}

module.exports = RankingsDTO;