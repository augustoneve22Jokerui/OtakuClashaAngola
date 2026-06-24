/**
 * 🏆 OTAKU CLASH ANGOLA - TOURNAMENTS REPOSITORY
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Gestão de persistência para torneios oficiais, chaves e participantes.
 */

const BaseRepository = require('../../core/base/BaseRepository');
const logger = require('../../config/logger');

class TournamentsRepository extends BaseRepository {
  constructor() {
    super('public.tournaments');
  }

  /**
   * 📑 LISTAGEM DE TORNEIOS COM MÉTRICAS DE OCUPAÇÃO
   * @param {Object} params - { status, animeId, limit, offset }
   */
  async findActiveTournaments({ status, animeId, limit = 10, offset = 0 }) {
    let query = `
      SELECT 
        t.*, 
        a.title as "animeTitle", 
        a.image_url as "animeImage",
        (SELECT COUNT(*) FROM public.tournament_participants WHERE tournament_id = t.id) as "currentParticipants"
      FROM public.tournaments t
      LEFT JOIN public.animes a ON t.anime_id = a.id
      WHERE 1=1
    `;

    const values = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND t.status = $${paramIndex++}`;
      values.push(status);
    } else {
      query += ` AND t.status != 'CANCELLED'`;
    }

    if (animeId) {
      query += ` AND t.anime_id = $${paramIndex++}`;
      values.push(animeId);
    }

    query += ` ORDER BY t.start_at ASC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    values.push(limit, offset);

    try {
      const { rows } = await this.db.query(query, values);
      return rows;
    } catch (error) {
      logger.error(`[TournamentsRepo:findActive] Erro: ${error.message}`);
      return [];
    }
  }

  /**
   * 🔍 BUSCA DETALHADA DE UM TORNEIO
   */
  async findDetailedById(id) {
    const query = `
      SELECT 
        t.*, 
        a.title as "animeTitle", 
        a.image_url as "animeImage",
        (SELECT COUNT(*) FROM public.tournament_participants WHERE tournament_id = t.id) as "currentParticipants"
      FROM public.tournaments t
      LEFT JOIN public.animes a ON t.anime_id = a.id
      WHERE t.id = $1
      LIMIT 1
    `;

    try {
      const { rows } = await this.db.query(query, [id]);
      return rows[0] || null;
    } catch (error) {
      logger.error(`[TournamentsRepo:findDetailed] Erro: ${error.message}`);
      return null;
    }
  }

  /**
   * 👥 ADICIONA PARTICIPANTE (ATÔMICO)
   */
  async addParticipant(tournamentId, userId, client = null) {
    const query = `
      INSERT INTO public.tournament_participants (tournament_id, user_id, joined_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (tournament_id, user_id) DO NOTHING
      RETURNING *
    `;

    try {
      const executor = client || this.db;
      const { rows } = await executor.query(query, [tournamentId, userId]);
      return rows[0] || null;
    } catch (error) {
      logger.error(`[TournamentsRepo:addParticipant] Falha: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🏃 REMOVE PARTICIPANTE (ESTORNO/SAÍDA)
   */
  async removeParticipant(tournamentId, userId, client = null) {
    const query = `
      DELETE FROM public.tournament_participants 
      WHERE tournament_id = $1 AND user_id = $2
      RETURNING user_id
    `;
    
    try {
      const executor = client || this.db;
      const { rows } = await executor.query(query, [tournamentId, userId]);
      return rows.length > 0;
    } catch (error) {
      logger.error(`[TournamentsRepo:removeParticipant] Falha: ${error.message}`);
      throw error;
    }
  }

  /**
   * ✅ VERIFICA INSCRIÇÃO EXISTENTE
   */
  async isUserRegistered(tournamentId, userId) {
    const query = `
      SELECT 1 FROM public.tournament_participants 
      WHERE tournament_id = $1 AND user_id = $2 
      LIMIT 1
    `;
    try {
      const { rows } = await this.db.query(query, [tournamentId, userId]);
      return rows.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * 📋 LISTA INSCRITOS PARA O MODAL ADMIN
   */
  async getParticipants(tournamentId) {
    const query = `
      SELECT 
        p.id, 
        p.username, 
        p.avatar_url as "avatarUrl", 
        p.level, 
        tp.joined_at as "joinedAt"
      FROM public.tournament_participants tp
      JOIN public.profiles p ON tp.user_id = p.id
      WHERE tp.tournament_id = $1
      ORDER BY tp.joined_at ASC
    `;
    
    try {
      const { rows } = await this.db.query(query, [tournamentId]);
      return rows;
    } catch (error) {
      return [];
    }
  }

  /**
   * 🆔 BUSCA TORNEIOS QUE O JOGADOR ESTÁ INSCRITO
   */
  async findByUserId(userId) {
    const query = `
      SELECT t.*, tp.joined_at, tp.position, tp.reward_amount
      FROM public.tournaments t
      JOIN public.tournament_participants tp ON t.id = tp.tournament_id
      WHERE tp.user_id = $1
      ORDER BY t.start_at DESC
    `;
    try {
      const { rows } = await this.db.query(query, [userId]);
      return rows;
    } catch (error) {
      return [];
    }
  }

  /**
   * 📊 ATUALIZA STATUS OPERACIONAL
   */
  async updateStatus(tournamentId, status, client = null) {
    const executor = client || this.db;
    const query = `UPDATE ${this.tableName} SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`;
    
    try {
      const { rows } = await executor.query(query, [status, tournamentId]);
      return rows[0];
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new TournamentsRepository();