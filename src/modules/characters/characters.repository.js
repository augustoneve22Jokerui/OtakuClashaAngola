/**
 * 👤 OTAKU CLASH ANGOLA - CHARACTERS REPOSITORY
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Gestão de persistência para personagens, biografia e vínculos com animes.
 */

const BaseRepository = require('../../core/base/BaseRepository');
const logger = require('../../config/logger');

class CharactersRepository extends BaseRepository {
  constructor() {
    super('public.characters');
  }

  /**
   * 🔍 BUSCA TODOS OS PERSONAGENS DE UM ANIME
   * @param {number} animeId - ID local do anime.
   */
  async findByAnimeId(animeId) {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE anime_id = $1
      ORDER BY role ASC, name ASC
    `;
    
    try {
      const { rows } = await this.db.query(query, [animeId]);
      return rows;
    } catch (error) {
      logger.error(`[CharactersRepo:findByAnime] Erro: ${error.message}`);
      return [];
    }
  }

  /**
   * 📋 LISTAGEM COM FILTROS E VÍNCULO DE ANIME (ADMIN VIEW)
   * Realiza JOIN para trazer o título do anime, facilitando a curadoria.
   */
  async findWithFilters({ search, animeId, limit = 20, offset = 0 }) {
    let query = `
      SELECT 
        c.id, 
        c.name, 
        c.mal_id as "malId", 
        c.image_url as "imageUrl", 
        c.role, 
        c.created_at,
        c.anime_id as "animeId",
        a.title as "animeTitle"
      FROM public.characters c
      LEFT JOIN public.animes a ON c.anime_id = a.id
      WHERE 1=1
    `;

    const values = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND c.name ILIKE $${paramIndex++}`;
      values.push(`%${search}%`);
    }

    if (animeId) {
      query += ` AND c.anime_id = $${paramIndex++}`;
      values.push(animeId);
    }

    query += ` ORDER BY c.name ASC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    values.push(limit, offset);

    try {
      const { rows } = await this.db.query(query, values);
      return rows;
    } catch (error) {
      logger.error(`[CharactersRepo:findWithFilters] Erro: ${error.message}`);
      return [];
    }
  }

  /**
   * 🎲 OBTÉM PERSONAGENS ALEATÓRIOS (PARA QUIZ)
   * @param {number} limit - Quantidade de personagens.
   * @param {number} [excludeId] - ID para não repetir o personagem da questão.
   */
  async getRandomCharacters(limit = 4, excludeId = null) {
    let query = `
      SELECT id, name, image_url as "imageUrl" 
      FROM ${this.tableName}
      WHERE 1=1
    `;
    const values = [limit];

    if (excludeId) {
      query += ` AND id != $2`;
      values.push(excludeId);
    }

    query += ` ORDER BY RANDOM() LIMIT $1`;

    try {
      const { rows } = await this.db.query(query, values);
      return rows;
    } catch (error) {
      logger.error(`[CharactersRepo:getRandom] Erro: ${error.message}`);
      return [];
    }
  }

  /**
   * 📊 MÉTRICAS DE PERSONAGENS (ADMIN DASHBOARD)
   */
  async getCharacterStats() {
    const query = `
      SELECT 
        COUNT(*) as "totalCharacters",
        COUNT(DISTINCT anime_id) as "animesWithCharacters",
        COUNT(*) FILTER (WHERE role = 'Main') as "mainCharactersCount"
      FROM ${this.tableName}
    `;
    
    try {
      const { rows } = await this.db.query(query);
      return rows[0];
    } catch (error) {
      return { totalCharacters: 0, animesWithCharacters: 0, mainCharactersCount: 0 };
    }
  }

  /**
   * 🆔 BUSCA POR MAL_ID (SINCRONIZAÇÃO JIKAN)
   */
  async findByMalId(malId) {
    return await this.findOneByField('mal_id', parseInt(malId));
  }

  /**
   * 🔄 UPSERT PARA SINCRONIZAÇÃO
   * Garante integridade ao atualizar dados vindos da Jikan API.
   */
  async syncUpsert(charData) {
    // Conflict target is 'mal_id' as it is unique
    return await this.upsert(charData, 'mal_id');
  }
}

module.exports = new CharactersRepository();