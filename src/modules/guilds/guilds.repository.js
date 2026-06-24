/**
 * 🛡️ OTAKU CLASH ANGOLA - GUILDS REPOSITORY
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Camada de persistência para clãs, membros e progressão de nível.
 */

const BaseRepository = require('../../core/base/BaseRepository');
const logger = require('../../config/logger');

class GuildsRepository extends BaseRepository {
  constructor() {
    super('public.guilds');
  }

  /**
   * 🔍 BUSCA GUILDA POR ID COM DADOS DO LÍDER
   */
  async findByIdWithDetails(id) {
    const query = `
      SELECT 
        g.*, 
        p.username as "leaderUsername", 
        p.avatar_url as "leaderAvatar"
      FROM public.guilds g
      JOIN public.profiles p ON g.leader_id = p.id
      WHERE g.id = $1
      LIMIT 1
    `;
    
    try {
      const { rows } = await this.db.query(query, [id]);
      return rows[0] || null;
    } catch (error) {
      logger.error(`[GuildsRepo:findById] Erro: ${error.message}`);
      return null;
    }
  }

  /**
   * 👥 LISTA MEMBROS DA GUILDA
   */
  async findMembers(guildId) {
    const query = `
      SELECT 
        p.id, 
        p.username, 
        p.avatar_url as "avatarUrl", 
        p.level, 
        gm.rank, 
        gm.joined_at as "joinedAt"
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
    
    try {
      const { rows } = await this.db.query(query, [guildId]);
      return rows;
    } catch (error) {
      logger.error(`[GuildsRepo:findMembers] Erro: ${error.message}`);
      return [];
    }
  }

  /**
   * 🆔 BUSCA QUAL GUILDA O UTILIZADOR PERTENCE
   */
  async findByUserId(userId) {
    const query = `
      SELECT g.*, gm.rank, gm.joined_at
      FROM public.guild_members gm
      JOIN public.guilds g ON gm.guild_id = g.id
      WHERE gm.user_id = $1
      LIMIT 1
    `;
    
    try {
      const { rows } = await this.db.query(query, [userId]);
      return rows[0] || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * ➕ ADICIONA MEMBRO (TRANSACTIONAL)
   */
  async addMember(guildId, userId, rank = 'MEMBER', client = null) {
    const query = `
      INSERT INTO public.guild_members (guild_id, user_id, rank, joined_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING *
    `;
    
    try {
      const executor = client || this.db;
      const { rows } = await executor.query(query, [guildId, userId, rank]);
      
      // Atualiza contador na tabela principal
      await executor.query(
        'UPDATE public.guilds SET member_count = member_count + 1 WHERE id = $1',
        [guildId]
      );
      
      return rows[0];
    } catch (error) {
      logger.error(`[GuildsRepo:addMember] Falha: ${error.message}`);
      throw error;
    }
  }

  /**
   * ➖ REMOVE MEMBRO (TRANSACTIONAL)
   */
  async removeMember(guildId, userId, client = null) {
    const query = `
      DELETE FROM public.guild_members 
      WHERE guild_id = $1 AND user_id = $2
      RETURNING *
    `;
    
    try {
      const executor = client || this.db;
      const { rows } = await executor.query(query, [guildId, userId]);
      
      if (rows.length > 0) {
        await executor.query(
          'UPDATE public.guilds SET member_count = member_count - 1 WHERE id = $1',
          [guildId]
        );
      }
      
      return rows.length > 0;
    } catch (error) {
      logger.error(`[GuildsRepo:removeMember] Falha: ${error.message}`);
      throw error;
    }
  }

  /**
   * 📈 ATUALIZA PROGRESSÃO DA GUILDA
   * Adiciona XP e calcula novo nível (Fórmula: floor(sqrt(xp/1000)) + 1)
   */
  async addExperience(guildId, xpAmount, client = null) {
    const query = `
      UPDATE public.guilds
      SET 
        xp = xp + $1,
        level = FLOOR(SQRT((xp + $1) / 1000)) + 1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING level, xp
    `;
    
    try {
      const executor = client || this.db;
      const { rows } = await executor.query(query, [xpAmount, guildId]);
      return rows[0];
    } catch (error) {
      logger.error(`[GuildsRepo:Experience] Falha: ${error.message}`);
      return null;
    }
  }

  /**
   * 🛡️ ATUALIZA RANK DO MEMBRO
   */
  async updateMemberRank(guildId, userId, newRank) {
    const query = `
      UPDATE public.guild_members
      SET rank = $1
      WHERE guild_id = $2 AND user_id = $3
      RETURNING rank
    `;
    try {
      const { rows } = await this.db.query(query, [newRank, guildId, userId]);
      return rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * 🔍 VERIFICA UNICIDADE DE NOME OU TAG
   */
  async checkAvailability(name, tag) {
    const query = `SELECT id FROM public.guilds WHERE name = $1 OR tag = $2 LIMIT 1`;
    try {
      const { rows } = await this.db.query(query, [name, tag]);
      return rows.length === 0;
    } catch (error) {
      return false;
    }
  }
}

module.exports = new GuildsRepository();