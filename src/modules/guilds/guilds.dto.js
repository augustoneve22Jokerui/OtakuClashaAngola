/**
 * GuildsDTO - Responsável pela transformação e formatação de dados de clãs e membros.
 */
class GuildsDTO {
  /**
   * Transforma os dados básicos de uma guilda para listagem.
   * @param {Object} guild - Registro bruto da tabela guilds.
   */
  static transform(guild) {
    if (!guild) return null;

    return {
      id: guild.id,
      name: guild.name,
      tag: guild.tag,
      description: guild.description,
      logoUrl: guild.logo_url,
      level: parseInt(guild.level || 1),
      xp: parseInt(guild.xp || 0),
      memberCount: parseInt(guild.member_count || 0),
      maxMembers: parseInt(guild.max_members || 20),
      leaderId: guild.leader_id,
      createdAt: guild.created_at
    };
  }

  /**
   * Transforma uma lista de guildas.
   * @param {Array} guilds 
   */
  static transformMany(guilds) {
    if (!guilds || !Array.isArray(guilds)) return [];
    return guilds.map(guild => this.transform(guild));
  }

  /**
   * Transforma os detalhes completos de uma guilda, incluindo membros.
   * @param {Object} guildDetails - Guilda com array de membros.
   */
  static transformDetails(guildDetails) {
    if (!guildDetails) return null;

    const base = this.transform(guildDetails);

    return {
      ...base,
      leader: {
        id: guildDetails.leader_id,
        username: guildDetails.leader_username,
        avatarUrl: guildDetails.leader_avatar
      },
      members: (guildDetails.members || []).map(member => ({
        id: member.id,
        username: member.username,
        avatarUrl: member.avatar_url,
        level: parseInt(member.level || 1),
        rank: member.rank,
        joinedAt: member.joined_at
      }))
    };
  }

  /**
   * Formata os dados de rank de um membro específico.
   * @param {Object} memberData 
   */
  static transformMemberStatus(memberData) {
    if (!memberData) return null;

    return {
      guildId: memberData.guild_id,
      guildName: memberData.name,
      guildTag: memberData.tag,
      rank: memberData.rank,
      joinedAt: memberData.joined_at
    };
  }
}

module.exports = GuildsDTO;