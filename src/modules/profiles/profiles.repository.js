const BaseRepository = require('../../core/base/BaseRepository');

/**
 * ProfilesRepository - Gerencia a persistência e consulta de perfis de usuários.
 */
class ProfilesRepository extends BaseRepository {
  constructor() {
    super('public.profiles');
  }

  /**
   * Busca um perfil detalhado pelo ID do usuário.
   * @param {string} userId - UUID do usuário.
   */
  async findByUserId(userId) {
    const query = `
      SELECT 
        p.*, 
        (SELECT COUNT(*) FROM public.user_achievements WHERE user_id = p.id) as achievements_count,
        (SELECT COUNT(*) FROM public.match_players WHERE user_id = p.id AND position = 1) as wins_count
      FROM ${this.tableName} p
      WHERE p.id = $1
    `;
    const { rows } = await this.db.query(query, [userId]);
    return rows[0] || null;
  }

  /**
   * Atualiza os dados básicos do perfil.
   */
  async updateProfile(userId, data) {
    const { username, full_name, avatar_url } = data;
    
    const query = `
      UPDATE ${this.tableName}
      SET 
        username = COALESCE($1, username),
        full_name = COALESCE($2, full_name),
        avatar_url = COALESCE($3, avatar_url),
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `;
    
    const { rows } = await this.db.query(query, [username, full_name, avatar_url, userId]);
    return rows[0];
  }

  /**
   * Obtém estatísticas completas de jogo do perfil.
   */
  async getProfileStats(userId) {
    const query = `
      SELECT 
        (SELECT COUNT(*) FROM public.match_players WHERE user_id = $1) as total_matches,
        (SELECT COUNT(*) FROM public.match_players WHERE user_id = $1 AND position = 1) as victories,
        (SELECT SUM(score) FROM public.match_players WHERE user_id = $1) as total_score,
        (SELECT COUNT(*) FROM public.user_achievements WHERE user_id = $1) as achievements,
        (SELECT name FROM public.guilds g JOIN public.guild_members gm ON g.id = gm.guild_id WHERE gm.user_id = $1 LIMIT 1) as guild_name
    `;
    
    const { rows } = await this.db.query(query, [userId]);
    const stats = rows[0];

    return {
      totalMatches: parseInt(stats.total_matches || 0),
      victories: parseInt(stats.victories || 0),
      totalScore: parseInt(stats.total_score || 0),
      achievementsCount: parseInt(stats.achievements || 0),
      guildName: stats.guild_name || 'Sem Guilda',
      winRate: stats.total_matches > 0 
        ? ((parseInt(stats.victories) / parseInt(stats.total_matches)) * 100).toFixed(1) 
        : "0.0"
    };
  }

  /**
   * Busca perfis por username (Pesquisa de amigos/usuários).
   */
  async searchProfiles(term, limit = 10) {
    const query = `
      SELECT id, username, avatar_url, level, xp
      FROM ${this.tableName}
      WHERE username ILIKE $1
      ORDER BY level DESC, xp DESC
      LIMIT $2
    `;
    const { rows } = await this.db.query(query, [`%${term}%`, limit]);
    return rows;
  }

  /**
   * Atualiza o status de presença (Online/Offline).
   */
  async updatePresence(userId, isOnline) {
    const query = `
      UPDATE ${this.tableName} 
      SET is_online = $1, last_seen = NOW() 
      WHERE id = $2
    `;
    await this.db.query(query, [isOnline, userId]);
  }
}

module.exports = new ProfilesRepository();