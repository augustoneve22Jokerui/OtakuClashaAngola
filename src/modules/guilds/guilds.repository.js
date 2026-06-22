const BaseRepository = require('../../core/base/BaseRepository');

/**
 * GuildsRepository - Gerencia a persistência de clãs e seus membros.
 */
class GuildsRepository extends BaseRepository {
  constructor() {
    super('public.guilds');
  }

  /**
   * Busca uma guilda pelo nome ou pela TAG única.
   */
  async findByNameOrTag(name, tag) {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE name = $1 OR tag = $2 
      LIMIT 1
    `;
    const { rows } = await this.db.query(query, [name, tag]);
    return rows[0] || null;
  }

  /**
   * Busca os detalhes de uma guilda incluindo informações do líder.
   */
  async findByIdWithLeader(id) {
    const query = `
      SELECT g.*, p.username as leader_username, p.avatar_url as leader_avatar
      FROM ${this.tableName} g
      JOIN public.profiles p ON g.leader_id = p.id
      WHERE g.id = $1
    `;
    const { rows } = await this.db.query(query, [id]);
    return rows[0] || null;
  }

  /**
   * Lista todos os membros de uma guilda específica.
   */
  async findMembers(guildId) {
    const query = `
      SELECT gm.rank, gm.joined_at, p.id, p.username, p.avatar_url, p.level, p.xp
      FROM public.guild_members gm
      JOIN public.profiles p ON gm.user_id = p.id
      WHERE gm.guild_id = $1
      ORDER BY 
        CASE gm.rank 
          WHEN 'LEADER' THEN 1 
          WHEN 'OFFICER' THEN 2 
          ELSE 3 
        END, 
        gm.joined_at ASC
    `;
    const { rows } = await this.db.query(query, [guildId]);
    return rows;
  }

  /**
   * Adiciona um membro à guilda.
   */
  async addMember(guildId, userId, rank = 'MEMBER', client = null) {
    const query = `
      INSERT INTO public.guild_members (guild_id, user_id, rank, joined_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING *
    `;
    const executor = client || this.db;
    const { rows } = await executor.query(query, [guildId, userId, rank]);
    return rows[0];
  }

  /**
   * Remove um membro da guilda.
   */
  async removeMember(guildId, userId, client = null) {
    const query = `
      DELETE FROM public.guild_members 
      WHERE guild_id = $1 AND user_id = $2
      RETURNING user_id
    `;
    const executor = client || this.db;
    const { rows } = await executor.query(query, [guildId, userId]);
    return rows.length > 0;
  }

  /**
   * Verifica se um usuário já pertence a alguma guilda.
   */
  async getUserGuild(userId) {
    const query = `
      SELECT g.*, gm.rank
      FROM public.guilds g
      JOIN public.guild_members gm ON g.id = gm.guild_id
      WHERE gm.user_id = $1
      LIMIT 1
    `;
    const { rows } = await this.db.query(query, [userId]);
    return rows[0] || null;
  }

  /**
   * Atualiza o rank de um membro.
   */
  async updateMemberRank(guildId, userId, newRank) {
    const query = `
      UPDATE public.guild_members 
      SET rank = $1 
      WHERE guild_id = $2 AND user_id = $3
      RETURNING rank
    `;
    const { rows } = await this.db.query(query, [newRank, guildId, userId]);
    return rows[0];
  }

  /**
   * Adiciona XP à guilda e gerencia level up.
   */
  async addExperience(guildId, xpAmount) {
    const query = `
      UPDATE ${this.tableName}
      SET xp = xp + $1,
          level = floor(sqrt((xp + $1) / 1000)) + 1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING level, xp
    `;
    const { rows } = await this.db.query(query, [xpAmount, guildId]);
    return rows[0];
  }

  /**
   * Busca guilda por TAG.
   */
  async findByTag(tag) {
    const query = `SELECT * FROM ${this.tableName} WHERE tag = $1 LIMIT 1`;
    const { rows } = await this.db.query(query, [tag.toUpperCase()]);
    return rows[0] || null;
  }
}

module.exports = new GuildsRepository();