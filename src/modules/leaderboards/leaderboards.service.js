/**
 * 🏆 OTAKU CLASH ANGOLA - LEADERBOARDS SERVICE
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Orquestrador de classificações competitivas com cache híbrido de alta performance.
 */

const BaseService = require('../../core/base/BaseService');
const leaderboardsRepository = require('./leaderboards.repository');
const cacheProvider = require('../../config/hybridRedis');
const logger = require('../../config/logger');
const AppError = require('../../core/errors/AppError');

class LeaderboardsService extends BaseService {
  constructor() {
    super(leaderboardsRepository);
    
    // Configurações de expiração do cache (em segundos)
    this.CACHE_KEYS = {
      GLOBAL: 'leaderboard:global',
      PERIOD: 'leaderboard:period',
      GUILDS: 'leaderboard:guilds',
      ANIME: 'leaderboard:anime'
    };
    
    this.TTLS = {
      GLOBAL: 3600,  // 1 hora
      PERIOD: 1800,  // 30 minutos
      GUILDS: 3600,  // 1 hora
      ANIME: 1800    // 30 minutos
    };
  }

  /**
   * 🌍 RANKING GLOBAL DE XP (CACHED)
   */
  async getGlobalRanking({ page = 1, limit = 50 }) {
    const cacheKey = `${this.CACHE_KEYS.GLOBAL}:p${page}:l${limit}`;

    try {
      // 1. Tenta recuperar do Cache Híbrido
      if (cacheProvider.enabled) {
        const cached = await cacheProvider.client.get(cacheKey);
        if (cached) {
          logger.debug(`[Leaderboard:Cache] Hit Global P${page}`);
          return JSON.parse(cached);
        }
      }

      // 2. Se não houver cache, busca no repositório
      const offset = (page - 1) * limit;
      const ranking = await this.repository.getGlobalLeaderboard(limit, offset);

      // 3. Salva no cache se houver resultados
      if (ranking.length > 0 && cacheProvider.enabled) {
        await cacheProvider.client.set(cacheKey, JSON.stringify(ranking), 'EX', this.TTLS.GLOBAL);
      }

      return ranking;
    } catch (error) {
      logger.error(`[LeaderboardService:Global] Erro: ${error.message}`);
      // Fallback para o banco de dados em caso de falha no cache
      return await this.repository.getGlobalLeaderboard(limit, (page - 1) * limit);
    }
  }

  /**
   * 📅 RANKING POR PERÍODO (CACHED)
   * @param {string} type - 'daily' | 'weekly' | 'monthly'
   */
  async getPeriodRanking(type, limit = 50) {
    const intervals = {
      daily: '1 day',
      weekly: '7 days',
      monthly: '30 days'
    };

    const interval = intervals[type];
    if (!interval) {
      throw AppError.badRequest('Tipo de período inválido para classificação.');
    }

    const cacheKey = `${this.CACHE_KEYS.PERIOD}:${type}:l${limit}`;

    try {
      if (cacheProvider.enabled) {
        const cached = await cacheProvider.client.get(cacheKey);
        if (cached) return JSON.parse(cached);
      }

      const ranking = await this.repository.getLeaderboardByPeriod(interval, limit);

      if (ranking.length > 0 && cacheProvider.enabled) {
        await cacheProvider.client.set(cacheKey, JSON.stringify(ranking), 'EX', this.TTLS.PERIOD);
      }

      return ranking;
    } catch (error) {
      logger.error(`[LeaderboardService:Period] Erro: ${error.message}`);
      return await this.repository.getLeaderboardByPeriod(interval, limit);
    }
  }

  /**
   * 🛡️ RANKING DE CLÃS (CACHED)
   */
  async getGuildRanking(limit = 20) {
    const cacheKey = `${this.CACHE_KEYS.GUILDS}:l${limit}`;

    try {
      if (cacheProvider.enabled) {
        const cached = await cacheProvider.client.get(cacheKey);
        if (cached) return JSON.parse(cached);
      }

      const ranking = await this.repository.getGuildLeaderboard(limit);

      if (ranking.length > 0 && cacheProvider.enabled) {
        await cacheProvider.client.set(cacheKey, JSON.stringify(ranking), 'EX', this.TTLS.GUILDS);
      }

      return ranking;
    } catch (error) {
      logger.error(`[LeaderboardService:Guilds] Erro: ${error.message}`);
      return await this.repository.getGuildLeaderboard(limit);
    }
  }

  /**
   * 🆔 POSIÇÃO ATUAL DO UTILIZADOR (REAL-TIME)
   * Não utiliza cache para garantir precisão do feedback imediato pós-jogo.
   */
  async getUserRank(userId) {
    const userRank = await this.repository.getUserRankPosition(userId);
    if (!userRank) {
      throw AppError.notFound('Utilizador não localizado nos registos competitivos.');
    }
    return userRank;
  }

  /**
   * 🔥 RANKING POR ANIME ESPECÍFICO (CACHED)
   */
  async getRankingByAnime(animeId, limit = 50) {
    const cacheKey = `${this.CACHE_KEYS.ANIME}:${animeId}:l${limit}`;

    try {
      if (cacheProvider.enabled) {
        const cached = await cacheProvider.client.get(cacheKey);
        if (cached) return JSON.parse(cached);
      }

      const ranking = await this.repository.getLeaderboardByAnime(animeId, limit);

      if (ranking.length > 0 && cacheProvider.enabled) {
        await cacheProvider.client.set(cacheKey, JSON.stringify(ranking), 'EX', this.TTLS.ANIME);
      }

      return ranking;
    } catch (error) {
      return await this.repository.getLeaderboardByAnime(animeId, limit);
    }
  }

  /**
   * 🧹 LIMPEZA DE CACHE (ADMIN UTILITY)
   * Invalida todos os rankings para forçar o recálculo.
   */
  async clearCache() {
    try {
      if (cacheProvider.enabled) {
        const keys = await cacheProvider.client.keys('otaku_clash:leaderboard:*');
        if (keys.length > 0) {
          const cleanKeys = keys.map(k => k.replace('otaku_clash:', ''));
          await cacheProvider.client.del(...cleanKeys);
        }
      } else {
        cacheProvider.client._storage.clear();
      }
      logger.warn('[LeaderboardService] Cache de classificações invalidado via STAFF.');
      return true;
    } catch (error) {
      logger.error(`[LeaderboardService:ClearCache] Falha: ${error.message}`);
      return false;
    }
  }
}

module.exports = new LeaderboardsService();