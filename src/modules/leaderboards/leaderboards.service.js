const BaseService = require('../../core/base/BaseService');
const leaderboardsRepository = require('./leaderboards.repository');
const cacheProvider = require('../../config/cache');
const logger = require('../../config/logger');
const AppError = require('../../core/errors/AppError');

/**
 * LeaderboardsService - Gerencia a lógica de rankings competitivos com cache de alta performance.
 */
class LeaderboardsService extends BaseService {
  constructor() {
    super(leaderboardsRepository);
    // Tempos de vida do cache (em segundos)
    this.TTL_GLOBAL = 3600; // 1 hora
    this.TTL_PERIOD = 1800; // 30 minutos
  }

  /**
   * Obtém o ranking global de jogadores.
   * @param {Object} params - { page, limit }
   */
  async getGlobalRanking({ page = 1, limit = 50 }) {
    const cacheKey = `leaderboard:global:p${page}:l${limit}`;
    
    try {
      // 1. Tenta recuperar do cache
      const cached = await cacheProvider.get(cacheKey);
      if (cached) return cached;

      // 2. Busca no repositório
      const offset = (page - 1) * limit;
      const ranking = await this.repository.getGlobalLeaderboard(limit, offset);
      
      // 3. Salva no cache
      await cacheProvider.set(cacheKey, ranking, this.TTL_GLOBAL);
      
      return ranking;
    } catch (error) {
      logger.error(`[LeaderboardsService] Erro no ranking global: ${error.message}`);
      // Fallback para o banco se o Redis falhar
      return await this.repository.getGlobalLeaderboard(limit, (page - 1) * limit);
    }
  }

  /**
   * Obtém ranking por período (Diário, Semanal ou Mensal).
   * @param {string} type - 'daily' | 'weekly' | 'monthly'
   * @param {number} limit
   */
  async getPeriodRanking(type, limit = 50) {
    const intervals = {
      daily: '1 day',
      weekly: '7 days',
      monthly: '30 days'
    };

    const interval = intervals[type];
    if (!interval) throw AppError.badRequest('Tipo de período inválido para ranking.');

    const cacheKey = `leaderboard:period:${type}:l${limit}`;

    try {
      const cached = await cacheProvider.get(cacheKey);
      if (cached) return cached;

      const ranking = await this.repository.getLeaderboardByPeriod(interval, limit);
      
      await cacheProvider.set(cacheKey, ranking, this.TTL_PERIOD);
      return ranking;
    } catch (error) {
      logger.error(`[LeaderboardsService] Erro no ranking por período (${type}): ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtém o ranking de Guildas (Clãs).
   */
  async getGuildRanking(limit = 20) {
    const cacheKey = `leaderboard:guilds:l${limit}`;

    try {
      const cached = await cacheProvider.get(cacheKey);
      if (cached) return cached;

      const ranking = await this.repository.getGuildLeaderboard(limit);
      
      await cacheProvider.set(cacheKey, ranking, this.TTL_GLOBAL);
      return ranking;
    } catch (error) {
      logger.error(`[LeaderboardsService] Erro no ranking de guildas: ${error.message}`);
      return await this.repository.getGuildLeaderboard(limit);
    }
  }

  /**
   * Obtém a posição atual de um usuário específico no ranking global.
   * @param {string} userId 
   */
  async getUserRank(userId) {
    try {
      const userRank = await this.repository.getUserRankPosition(userId);
      if (!userRank) {
        throw AppError.notFound('Usuário não encontrado nos registros de ranking.');
      }
      return userRank;
    } catch (error) {
      logger.error(`[LeaderboardsService] Erro ao buscar rank do usuário ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtém ranking para um anime específico.
   * @param {number} animeId 
   */
  async getRankingByAnime(animeId, limit = 50) {
    const cacheKey = `leaderboard:anime:${animeId}:l${limit}`;

    try {
      const cached = await cacheProvider.get(cacheKey);
      if (cached) return cached;

      const ranking = await this.repository.getLeaderboardByAnime(animeId, limit);
      
      await cacheProvider.set(cacheKey, ranking, this.TTL_PERIOD);
      return ranking;
    } catch (error) {
      logger.error(`[LeaderboardsService] Erro no ranking por anime: ${error.message}`);
      return await this.repository.getLeaderboardByAnime(animeId, limit);
    }
  }

  /**
   * Força a limpeza de todos os caches de ranking.
   * Útil após grandes eventos ou reset de temporada.
   */
  async clearLeaderboardCache() {
    try {
      await cacheProvider.delByPattern('leaderboard:*');
      logger.info('[LeaderboardsService] Cache de rankings limpo com sucesso.');
    } catch (error) {
      logger.error('[LeaderboardsService] Falha ao limpar cache de rankings.');
    }
  }
}

module.exports = new LeaderboardsService();