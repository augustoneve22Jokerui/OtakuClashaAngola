const BaseService = require('../../core/base/BaseService');
const animesRepository = require('./animes.repository');
const AppError = require('../../core/errors/AppError');
const logger = require('../../config/logger');
const cacheProvider = require('../../config/cache');

/**
 * AnimesService - Gerencia a lógica de negócio do catálogo de animes.
 */
class AnimesService extends BaseService {
  constructor() {
    super(animesRepository);
  }

  /**
   * Lista animes com filtros e paginação.
   * @param {Object} filters - { page, limit, genre, year, type, search }
   */
  async listAnimes(filters) {
    try {
      const items = await this.repository.findWithFilters(filters);
      const total = await this.repository.countWithFilters(filters);

      return {
        items,
        pagination: {
          total,
          page: filters.page,
          limit: filters.limit
        }
      };
    } catch (error) {
      logger.error(`[AnimesService] Erro ao listar animes: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtém detalhes completos de um anime, incluindo seus personagens.
   * @param {number} id - ID local do anime.
   */
  async getAnimeDetails(id) {
    const anime = await this.repository.findById(id);
    
    if (!anime) {
      throw AppError.notFound('Anime não encontrado no catálogo.');
    }

    // Busca personagens vinculados
    const { rows: characters } = await this.repository.db.query(
      'SELECT id, name, image_url, role FROM public.characters WHERE anime_id = $1 ORDER BY role ASC',
      [id]
    );

    return {
      ...anime,
      characters
    };
  }

  /**
   * Obtém os animes mais bem avaliados (com cache de 1 hora).
   */
  async getTopAnimes() {
    const cacheKey = 'animes:top_rated';
    
    try {
      const cached = await cacheProvider.get(cacheKey);
      if (cached) return cached;

      const topAnimes = await this.repository.findTopRated(10);
      
      await cacheProvider.set(cacheKey, topAnimes, 3600);
      return topAnimes;
    } catch (error) {
      logger.error(`[AnimesService] Erro ao obter top animes: ${error.message}`);
      return await this.repository.findTopRated(10); // Fallback sem cache
    }
  }

  /**
   * Obtém todos os gêneros únicos disponíveis no catálogo (com cache).
   */
  async getGenres() {
    const cacheKey = 'animes:genres_list';

    try {
      const cached = await cacheProvider.get(cacheKey);
      if (cached) return cached;

      const genres = await this.repository.findAllGenres();
      
      await cacheProvider.set(cacheKey, genres, 86400); // 24 horas de cache
      return genres;
    } catch (error) {
      logger.error(`[AnimesService] Erro ao obter gêneros: ${error.message}`);
      return [];
    }
  }

  /**
   * Sincroniza ou atualiza um anime específico vindo da Jikan.
   * @param {number} malId 
   */
  async syncAnimeByMalId(malId) {
    const AnimeSyncService = require('../../services/jikan/AnimeSyncService');
    const syncService = new AnimeSyncService();
    
    try {
      const result = await syncService.syncSingleAnime(malId);
      // Invalida cache de listas pois o catálogo mudou
      await cacheProvider.delByPattern('animes:*');
      return result;
    } catch (error) {
      logger.error(`[AnimesService] Falha na sincronização manual: ${error.message}`);
      throw new AppError('Não foi possível sincronizar o anime solicitado.', 500);
    }
  }
}

module.exports = new AnimesService();