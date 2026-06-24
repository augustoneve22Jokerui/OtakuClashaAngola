/**
 * 🎬 OTAKU CLASH ANGOLA - ANIMES SERVICE
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Lógica de negócio para o catálogo, gerenciamento de cache e sincronização.
 */

const BaseService = require('../../core/base/BaseService');
const animesRepository = require('./animes.repository');
const cacheProvider = require('../../config/hybridRedis');
const AppError = require('../../core/errors/AppError');
const logger = require('../../config/logger');

class AnimesService extends BaseService {
  constructor() {
    super(animesRepository);
    
    // Configurações de TTL (Time-To-Live) para o Cache
    this.TTL_GENRES = 86400; // 24 horas (Gêneros mudam raramente)
    this.TTL_TOP = 3600;    // 1 hora para o ranking de populares
  }

  /**
   * 📑 LISTAGEM DE ANIMES COM FILTROS
   */
  async listAnimes(filters) {
    try {
      const { page = 1, limit = 20, search, genre, type, year, orderBy, order } = filters;
      const offset = (page - 1) * limit;

      const items = await this.repository.findWithFilters({
        search,
        genre,
        type,
        year,
        limit,
        offset,
        orderBy,
        order
      });

      const total = await this.repository.countWithFilters({ search, genre, type, year });

      return {
        items,
        pagination: { total, page: parseInt(page), limit: parseInt(limit) }
      };
    } catch (error) {
      logger.error(`[AnimesService:List] Erro: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🔍 OBTÉM DETALHES COMPLETOS (COM PERSONAGENS)
   */
  async getAnimeDetails(id) {
    const anime = await this.repository.findById(id);
    
    if (!anime) {
      throw AppError.notFound('Anime não encontrado no catálogo local.');
    }

    // Busca personagens vinculados através do Repositório de Personagens
    // Import dinâmico para evitar dependência circular
    const charactersRepository = require('../characters/characters.repository');
    const characters = await charactersRepository.findByAnimeId(id);

    return {
      ...anime,
      characters
    };
  }

  /**
   * 🌟 ANIMES MAIS BEM AVALIADOS (CACHED)
   */
  async getTopAnimes(limit = 10) {
    const cacheKey = `animes:top:${limit}`;

    try {
      // 1. Tenta recuperar do Cache Híbrido
      const cached = await cacheProvider.client.get(cacheKey);
      if (cached) {
          logger.debug(`[Cache:Hit] ${cacheKey}`);
          return JSON.parse(cached);
      }

      // 2. Busca no Banco de Dados
      const topAnimes = await this.repository.findTopRated(limit);

      // 3. Salva no Cache
      if (topAnimes.length > 0) {
        await cacheProvider.client.set(cacheKey, JSON.stringify(topAnimes), 'EX', this.TTL_TOP);
      }

      return topAnimes;
    } catch (error) {
      logger.error(`[AnimesService:Top] Erro: ${error.message}`);
      return await this.repository.findTopRated(limit); // Fallback banco
    }
  }

  /**
   * 🏷️ LISTA DE GÊNEROS DISPONÍVEIS (CACHED)
   */
  async getGenres() {
    const cacheKey = 'animes:genres_list';

    try {
      const cached = await cacheProvider.client.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const genres = await this.repository.findAllGenres();

      if (genres.length > 0) {
        await cacheProvider.client.set(cacheKey, JSON.stringify(genres), 'EX', this.TTL_GENRES);
      }

      return genres;
    } catch (error) {
      return await this.repository.findAllGenres();
    }
  }

  /**
   * 🔄 SINCRONIZAÇÃO MANUAL VIA MAL_ID
   * Realiza a importação da Jikan API e invalida caches de listagem.
   */
  async syncAnimeByMalId(malId) {
    const AnimeSyncService = require('../../services/jikan/AnimeSyncService');
    const syncService = new AnimeSyncService();
    
    try {
      logger.info(`[AnimesService:Sync] Iniciando sincronização manual do MAL_ID: ${malId}`);
      
      const result = await syncService.syncSingleAnime(malId);
      
      // Invalida caches de listagem para que o Admin veja o novo anime/dados atualizados
      await this.clearAnimesCache();

      return result;
    } catch (error) {
      logger.error(`[AnimesService:Sync] Falha: ${error.message}`);
      throw new AppError(`Falha ao sincronizar com a Jikan API: ${error.message}`, 502);
    }
  }

  /**
   * 📊 MÉTRICAS PARA DASHBOARD
   */
  async getCatalogMetrics() {
    return await this.repository.getCatalogSummary();
  }

  /**
   * 🧹 LIMPEZA DE CACHE DO MÓDULO
   */
  async clearAnimesCache() {
    try {
      // Se Redis estiver ativo, usamos scan/del, senão limpamos o Map do fallback
      if (cacheProvider.enabled) {
        // Implementação simplificada de delete por pattern
        const keys = await cacheProvider.client.keys('otaku_clash:animes:*');
        if (keys.length > 0) {
            // Remove o prefixo da biblioteca para o comando del funcionar corretamente
            const cleanKeys = keys.map(k => k.replace('otaku_clash:', ''));
            await cacheProvider.client.del(...cleanKeys);
        }
      } else {
        cacheProvider.client._storage.clear();
      }
      logger.info('[AnimesService] Cache de catálogo invalidado.');
    } catch (err) {
      logger.warn(`[AnimesService:Cache] Erro ao invalidar: ${err.message}`);
    }
  }
}

module.exports = new AnimesService();