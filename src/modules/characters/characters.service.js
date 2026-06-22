const BaseService = require('../../core/base/BaseService');
const charactersRepository = require('./characters.repository');
const AppError = require('../../core/errors/AppError');
const logger = require('../../config/logger');

/**
 * CharactersService - Gerencia a lógica de negócio dos personagens de animes.
 */
class CharactersService extends BaseService {
  constructor() {
    super(charactersRepository);
  }

  /**
   * Lista personagens com filtros de busca e paginação.
   * @param {Object} params - { search, page, limit }
   */
  async listCharacters({ search, page = 1, limit = 20 }) {
    try {
      const offset = (page - 1) * limit;
      
      const items = await this.repository.findWithFilters({
        search,
        limit,
        offset
      });

      const total = await this.repository.count({
        ...(search && { name: search }) // Simplificação para o count da BaseRepository
      });

      return {
        items,
        pagination: {
          total,
          page,
          limit
        }
      };
    } catch (error) {
      logger.error(`[CharactersService] Erro ao listar personagens: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtém detalhes de um personagem específico.
   * @param {number} id 
   */
  async getCharacterDetails(id) {
    const character = await this.repository.findById(id);

    if (!character) {
      throw AppError.notFound('Personagem não encontrado.');
    }

    // Busca dados básicos do anime vinculado
    const { rows: [anime] } = await this.repository.db.query(
      'SELECT id, title, image_url FROM public.animes WHERE id = $1',
      [character.anime_id]
    );

    return {
      ...character,
      anime
    };
  }

  /**
   * Obtém uma lista de personagens aleatórios para o quiz.
   * @param {number} limit 
   * @param {number} [animeId] 
   */
  async getRandomForQuiz(limit = 4, animeId = null) {
    try {
      return await this.repository.getRandomCharacters(limit, animeId);
    } catch (error) {
      logger.error(`[CharactersService] Erro ao buscar personagens aleatórios: ${error.message}`);
      return [];
    }
  }

  /**
   * Obtém os personagens mais populares de um anime específico.
   * @param {number} animeId 
   */
  async getByAnime(animeId) {
    try {
      return await this.repository.findByAnimeId(animeId);
    } catch (error) {
      logger.error(`[CharactersService] Erro ao buscar personagens por anime: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new CharactersService();