const BaseRepository = require('../../core/base/BaseRepository');

/**
 * TournamentsRepository - Camada de acesso a dados para o sistema de torneios.
 * Nota: Assume-se a existência das tabelas public.tournaments e public.tournament_participants
 * para suportar a lógica enterprise de grandes competições.
 */
class TournamentsRepository extends BaseRepository {
  constructor() {
    super('public.tournaments');
  }

  /**
   * Busca todos os torneios ativos ou futuros.
   * @param {Object} params - { status, animeId, limit, offset }
   */
  async findActiveTournaments({ status, animeId, limit = 10, offset = 0 }) {
    let query = `
      SELECT t.*, a.title as anime_title, 
             (SELECT COUNT(*) FROM public.tournament_participants WHERE tournament_id = t.id) as current_participants
      FROM ${this.tableName} t
      LEFT JOIN public.animes a ON t.anime_id = a.id
      WHERE 1=1
    `;
    const values = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      query += ` AND t.status = $${paramCount}`;
      values.push(status);
    } else {
      query += ` AND t.status != 'FINISHED' AND t.status != 'CANCELLED'`;
    }

    if (animeId) {
      paramCount++;
      query += ` AND t.anime_id = $${paramCount}`;
      values.push(animeId);
    }

    query += ` ORDER BY t.start_at ASC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    values.push(limit, offset);

    const { rows } = await this.db.query(query, values);
    return rows;
  }

  /**
   * Busca detalhes de um torneio incluindo o líder e o anime.
   */
  async findDetailedById(id) {
    const query = `
      SELECT t.*, a.title as anime_title, a.image_url as anime_image,
             (SELECT COUNT(*) FROM public.tournament_participants WHERE tournament_id = t.id) as current_participants
      FROM ${this.tableName} t
      LEFT JOIN public.animes a ON t.anime_id = a.id
      WHERE t.id = $1
    `;
    const { rows } = await this.db.query(query, [id]);
    return rows[0] || null;
  }

  /**
   * Adiciona um participante ao torneio.
   */
  async addParticipant(tournamentId, userId, client = null) {
    const query = `
      INSERT INTO public.tournament_participants (tournament_id, user_id, joined_at)
      VALUES ($1, $2, NOW())
      RETURNING *
    `;
    const executor = client || this.db;
    const { rows } = await executor.query(query, [tournamentId, userId]);
    return rows[0];
  }

  /**
   * Remove um participante do torneio.
   */
  async removeParticipant(tournamentId, userId, client = null) {
    const query = `
      DELETE FROM public.tournament_participants 
      WHERE tournament_id = $1 AND user_id = $2
      RETURNING user_id
    `;
    const executor = client || this.db;
    const { rows } = await executor.query(query, [tournamentId, userId]);
    return rows.length > 0;
  }

  /**
   * Verifica se um usuário já está inscrito no torneio.
   */
  async isUserRegistered(tournamentId, userId) {
    const query = `
      SELECT 1 FROM public.tournament_participants 
      WHERE tournament_id = $1 AND user_id = $2 
      LIMIT 1
    `;
    const { rows } = await this.db.query(query, [tournamentId, userId]);
    return rows.length > 0;
  }

  /**
   * Lista todos os participantes de um torneio.
   */
  async getParticipants(tournamentId) {
    const query = `
      SELECT p.id, p.username, p.avatar_url, p.level, tp.joined_at
      FROM public.tournament_participants tp
      JOIN public.profiles p ON tp.user_id = p.id
      WHERE tp.tournament_id = $1
      ORDER BY tp.joined_at ASC
    `;
    const { rows } = await this.db.query(query, [tournamentId]);
    return rows;
  }

  /**
   * Atualiza o status do torneio.
   */
  async updateStatus(tournamentId, status) {
    const query = `
      UPDATE ${this.tableName}
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const { rows } = await this.db.query(query, [status, tournamentId]);
    return rows[0];
  }

  /**
   * Busca torneios que um usuário participou ou está participando.
   */
  async findUserTournaments(userId) {
    const query = `
      SELECT t.*, tp.joined_at, tp.position, tp.reward_amount
      FROM ${this.tableName} t
      JOIN public.tournament_participants tp ON t.id = tp.tournament_id
      WHERE tp.user_id = $1
      ORDER BY t.start_at DESC
    `;
    const { rows } = await this.db.query(query, [userId]);
    return rows;
  }
}

module.exports = new TournamentsRepository();