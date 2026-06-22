const BaseRepository = require('../../core/base/BaseRepository');

/**
 * CharactersRepository - Camada de acesso a dados para personagens de animes.
 */
class CharactersRepository extends BaseRepository {
  constructor() {
    super('public.characters');
  }

  /**
   * Busca todos os personagens de um anime específico.
   * @param {number} animeId - ID local do anime.
   */
  async findByAnimeId(animeId) {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE anime_id = $1
      ORDER BY role ASC, name ASC
    `;
    const { rows } = await this.db.query(query, [animeId]);
    return rows;
  }

  /**
   * Busca personagens com suporte a pesquisa textual e filtros.
   * @param {Object} params - { search, limit, offset }
   */
  async findWithFilters({ search, limit = 20, offset = 0 }) {
    let query = `
      SELECT c.*, a.title as anime_title 
      FROM ${this.tableName} c
      LEFT JOIN public.animes a ON c.anime_id = a.id
      WHERE 1=1
    `;
    const values = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      query += ` AND c.name ILIKE $${paramCount}`;
      values.push(`%${search}%`);
    }

    paramCount++;
    query += ` ORDER BY c.name ASC LIMIT $${paramCount}`;
    values.push(limit);

    paramCount++;
    query += ` OFFSET $${paramCount}`;
    values.push(offset);

    const { rows } = await this.db.query(query, values);
    return rows;
  }

  /**
   * Busca um personagem específico pelo MyAnimeList ID.
   * @param {number} malId 
   */
  async findByMalId(malId) {
    const query = `SELECT * FROM ${this.tableName} WHERE mal_id = $1 LIMIT 1`;
    const { rows } = await this.db.query(query, [malId]);
    return rows[0] || null;
  }

  /**
   * Obtém estatísticas básicas sobre os personagens.
   */
  async getCharacterStats() {
    const query = `
      SELECT 
        COUNT(*) as total_characters,
        COUNT(DISTINCT anime_id) as total_animes_with_chars,
        COUNT(*) FILTER (WHERE role = 'Main') as main_characters_count
      FROM ${this.tableName}
    `;
    const { rows } = await this.db.query(query);
    return {
      total: parseInt(rows[0].total_characters),
      animesCount: parseInt(rows[0].total_animes_with_chars),
      mainCount: parseInt(rows[0].main_characters_count)
    };
  }

  /**
   * Busca personagens aleatórios para o modo "Quem é esse personagem?" do quiz.
   * @param {number} limit 
   * @param {number} [animeId] - Opcional para filtrar por anime específico.
   */
  async getRandomCharacters(limit = 4, animeId = null) {
    let query = `SELECT id, name, image_url FROM ${this.tableName}`;
    const values = [limit];

    if (animeId) {
      query += ` WHERE anime_id = $2`;
      values.push(animeId);
    }

    query += ` ORDER BY RANDOM() LIMIT $1`;
    
    const { rows } = await this.db.query(query, values);
    return rows;
  }
}

module.exports = new CharactersRepository();