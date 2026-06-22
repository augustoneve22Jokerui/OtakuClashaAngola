const BaseRepository = require('../../core/base/BaseRepository');

/**
 * AnimesRepository - Camada de acesso a dados para o catálogo de animes.
 */
class AnimesRepository extends BaseRepository {
  constructor() {
    super('public.animes');
  }

  /**
   * Busca animes com filtros avançados e paginação.
   * @param {Object} params - { page, limit, genre, year, type, search, orderBy, order }
   */
  async findWithFilters({ 
    page = 1, 
    limit = 20, 
    genre = null, 
    year = null, 
    type = null, 
    search = null,
    orderBy = 'score',
    order = 'DESC'
  }) {
    const offset = (page - 1) * limit;
    let query = `SELECT * FROM ${this.tableName} WHERE 1=1`;
    const values = [];
    let paramCount = 0;

    // Filtro por Gênero (JSONB array containment)
    if (genre) {
      paramCount++;
      query += ` AND genres @> $${paramCount}`;
      values.push(JSON.stringify([genre]));
    }

    // Filtro por Ano
    if (year) {
      paramCount++;
      query += ` AND year = $${paramCount}`;
      values.push(year);
    }

    // Filtro por Tipo (TV, Movie, OVA, etc)
    if (type) {
      paramCount++;
      query += ` AND type = $${paramCount}`;
      values.push(type);
    }

    // Busca por Título
    if (search) {
      paramCount++;
      query += ` AND (title ILIKE $${paramCount} OR title_english ILIKE $${paramCount})`;
      values.push(`%${search}%`);
    }

    // Ordenação e Paginação
    query += ` ORDER BY ${orderBy} ${order} LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    values.push(limit, offset);

    const { rows } = await this.db.query(query, values);
    return rows;
  }

  /**
   * Conta o total de registros baseado nos mesmos filtros (para paginação).
   */
  async countWithFilters({ genre, year, type, search }) {
    let query = `SELECT COUNT(*) as total FROM ${this.tableName} WHERE 1=1`;
    const values = [];
    let paramCount = 0;

    if (genre) {
      paramCount++;
      query += ` AND genres @> $${paramCount}`;
      values.push(JSON.stringify([genre]));
    }

    if (year) {
      paramCount++;
      query += ` AND year = $${paramCount}`;
      values.push(year);
    }

    if (type) {
      paramCount++;
      query += ` AND type = $${paramCount}`;
      values.push(type);
    }

    if (search) {
      paramCount++;
      query += ` AND (title ILIKE $${paramCount} OR title_english ILIKE $${paramCount})`;
      values.push(`%${search}%`);
    }

    const { rows } = await this.db.query(query, values);
    return parseInt(rows[0].total, 10);
  }

  /**
   * Busca animes por popularidade (score) para o dashboard/home.
   */
  async findTopRated(limit = 10) {
    const query = `
      SELECT id, title, image_url, score, genres 
      FROM ${this.tableName} 
      ORDER BY score DESC 
      LIMIT $1
    `;
    const { rows } = await this.db.query(query, [limit]);
    return rows;
  }

  /**
   * Busca um anime pelo MyAnimeList ID.
   */
  async findByMalId(malId) {
    const query = `SELECT * FROM ${this.tableName} WHERE mal_id = $1 LIMIT 1`;
    const { rows } = await this.db.query(query, [malId]);
    return rows[0] || null;
  }

  /**
   * Lista todos os gêneros únicos presentes no catálogo.
   */
  async findAllGenres() {
    const query = `
      SELECT DISTINCT jsonb_array_elements_text(genres) as genre 
      FROM ${this.tableName} 
      ORDER BY genre ASC
    `;
    const { rows } = await this.db.query(query);
    return rows.map(r => r.genre);
  }
}

module.exports = new AnimesRepository();