/**
 * 🎬 OTAKU CLASH ANGOLA - ANIMES REPOSITORY
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Gestão de persistência para o catálogo de obras, metadados e gêneros.
 */

const BaseRepository = require('../../core/base/BaseRepository');
const logger = require('../../config/logger');

class AnimesRepository extends BaseRepository {
  constructor() {
    super('public.animes');
  }

  /**
   * 🔍 BUSCA COM FILTROS AVANÇADOS E PAGINAÇÃO
   * @param {Object} params - { search, genre, type, year, limit, offset, orderBy, order }
   */
  async findWithFilters({ 
    search, 
    genre, 
    type, 
    year, 
    limit = 20, 
    offset = 0, 
    orderBy = 'score', 
    order = 'DESC' 
  }) {
    let query = `SELECT * FROM ${this.tableName} WHERE 1=1`;
    const values = [];
    let paramIndex = 1;

    // Filtro por Título (Busca textual parcial)
    if (search) {
      query += ` AND (title ILIKE $${paramIndex} OR title_english ILIKE $${paramIndex})`;
      values.push(`%${search}%`);
      paramIndex++;
    }

    // Filtro por Gênero (Operador JSONB @> para verificar existência no array)
    if (genre) {
      query += ` AND genres @> $${paramIndex}::jsonb`;
      values.push(JSON.stringify([genre]));
      paramIndex++;
    }

    // Filtro por Formato (TV, Movie, OVA, etc)
    if (type) {
      query += ` AND type = $${paramIndex}`;
      values.push(type);
      paramIndex++;
    }

    // Filtro por Ano
    if (year) {
      query += ` AND year = $${paramIndex}`;
      values.push(parseInt(year));
      paramIndex++;
    }

    // Ordenação Segura
    const allowedSortFields = ['score', 'title', 'year', 'created_at'];
    const sortField = allowedSortFields.includes(orderBy) ? orderBy : 'score';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    query += ` ORDER BY ${sortField} ${sortOrder} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    values.push(limit, offset);

    try {
      const { rows } = await this.db.query(query, values);
      return rows;
    } catch (error) {
      logger.error(`[AnimesRepo:findWithFilters] Erro: ${error.message}`);
      return [];
    }
  }

  /**
   * 🔢 CONTAGEM FILTRADA (PARA PAGINAÇÃO)
   */
  async countWithFilters({ search, genre, type, year }) {
    let query = `SELECT COUNT(*) as total FROM ${this.tableName} WHERE 1=1`;
    const values = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (title ILIKE $${paramIndex} OR title_english ILIKE $${paramIndex})`;
      values.push(`%${search}%`);
      paramIndex++;
    }

    if (genre) {
      query += ` AND genres @> $${paramIndex}::jsonb`;
      values.push(JSON.stringify([genre]));
      paramIndex++;
    }

    if (type) {
      query += ` AND type = $${paramIndex}`;
      values.push(type);
      paramIndex++;
    }

    if (year) {
      query += ` AND year = $${paramIndex}`;
      values.push(parseInt(year));
    }

    try {
      const { rows } = await this.db.query(query, values);
      return parseInt(rows[0].total, 10);
    } catch (error) {
      return 0;
    }
  }

  /**
   * 🌟 OBTÉM ANIMES MAIS BEM AVALIADOS (TOP RATED)
   */
  async findTopRated(limit = 10) {
    const query = `
      SELECT id, mal_id, title, image_url, score, genres, type 
      FROM ${this.tableName} 
      WHERE score IS NOT NULL 
      ORDER BY score DESC 
      LIMIT $1
    `;
    try {
      const { rows } = await this.db.query(query, [limit]);
      return rows;
    } catch (error) {
      logger.error(`[AnimesRepo:findTopRated] Erro: ${error.message}`);
      return [];
    }
  }

  /**
   * 🏷️ LISTA TODOS OS GÊNEROS ÚNICOS PRESENTES NO BANCO
   * Utilizado para alimentar os filtros do Frontend.
   */
  async findAllGenres() {
    const query = `
      SELECT DISTINCT jsonb_array_elements_text(genres) as genre 
      FROM ${this.tableName} 
      ORDER BY genre ASC
    `;
    try {
      const { rows } = await this.db.query(query);
      return rows.map(r => r.genre);
    } catch (error) {
      logger.error(`[AnimesRepo:findAllGenres] Erro: ${error.message}`);
      return [];
    }
  }

  /**
   * 🆔 BUSCA POR MAL_ID (MYANIMELIST ID)
   */
  async findByMalId(malId) {
    return await this.findOneByField('mal_id', parseInt(malId));
  }

  /**
   * 🔄 UPSERT PARA SINCRONIZAÇÃO JIKAN
   * Garante que não existam duplicatas de MAL_ID e atualiza os dados.
   */
  async syncUpsert(animeData) {
    return await this.upsert(animeData, 'mal_id');
  }

  /**
   * 📊 MÉTRICAS DO CATÁLOGO (ADMIN)
   */
  async getCatalogSummary() {
    const query = `
      SELECT 
        COUNT(*) as "totalAnimes",
        AVG(score) as "averageScore",
        (SELECT COUNT(*) FROM public.questions) as "totalQuestions",
        (SELECT COUNT(*) FROM public.characters) as "totalCharacters"
      FROM ${this.tableName}
    `;
    try {
      const { rows } = await this.db.query(query);
      return rows[0];
    } catch (error) {
      return { totalAnimes: 0, averageScore: 0 };
    }
  }
}

module.exports = new AnimesRepository();