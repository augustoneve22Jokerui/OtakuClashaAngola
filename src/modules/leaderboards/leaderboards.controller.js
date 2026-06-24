/**
 * 🏆 OTAKU CLASH ANGOLA - LEADERBOARDS CONTROLLER
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Gerencia requisições de rankings globais, periódicos e competitivos.
 */

const BaseController = require('../../core/base/BaseController');
const leaderboardsService = require('./leaderboards.service');

class LeaderboardsController extends BaseController {
  constructor() {
    super();
  }

  /**
   * 🌍 RANKING GLOBAL DE JOGADORES (PAGINADO)
   * GET /api/v1/leaderboards/global
   */
  async getGlobal(req, res) {
    const { page, limit } = req.query;

    const ranking = await leaderboardsService.getGlobalRanking({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50
    });

    // Como o ranking global é volumoso, buscamos o total para a paginação
    const total = await leaderboardsService.repository.count({ role: 'USER' });

    return this.paginate(res, ranking, {
      total,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50
    });
  }

  /**
   * 📅 RANKING POR PERÍODO (DIÁRIO / SEMANAL / MENSAL)
   * GET /api/v1/leaderboards/period/:type
   */
  async getPeriodic(req, res) {
    const { type } = req.params; // daily, weekly, monthly
    const { limit } = req.query;

    const ranking = await leaderboardsService.getPeriodRanking(
      type,
      parseInt(limit) || 50
    );

    return this.success(res, ranking, `Ranking ${type} recuperado com sucesso.`);
  }

  /**
   * 🛡️ RANKING DE CLÃS (GUILDAS)
   * GET /api/v1/leaderboards/guilds
   */
  async getGuilds(req, res) {
    const { limit } = req.query;

    const ranking = await leaderboardsService.getGuildRanking(parseInt(limit) || 20);

    return this.success(res, ranking, 'Elite de clãs sincronizada.');
  }

  /**
   * 🆔 POSIÇÃO ATUAL DO UTILIZADOR LOGADO
   * GET /api/v1/leaderboards/me
   */
  async getMyRank(req, res) {
    const userId = req.user.id;
    
    const myRank = await leaderboardsService.getUserRank(userId);
    
    return this.success(res, myRank, 'A tua posição no ranking global foi recuperada.');
  }

  /**
   * 🔥 RANKING POR OBRA (ANIME)
   * GET /api/v1/leaderboards/anime/:animeId
   */
  async getByAnime(req, res) {
    const { animeId } = req.params;
    const { limit } = req.query;

    const ranking = await leaderboardsService.getRankingByAnime(
      parseInt(animeId),
      parseInt(limit) || 50
    );

    return this.success(res, ranking, 'Classificação por anime recuperada.');
  }

  /**
   * 🧹 LIMPEZA DE CACHE DE RANKING (ADMIN)
   * POST /api/v1/leaderboards/admin/clear-cache
   */
  async clearCache(req, res) {
    // A validação de role ADMIN é feita no arquivo de rotas
    await leaderboardsService.clearCache();
    
    return this.success(res, null, 'Cache de classificações invalidado com sucesso.');
  }
}

module.exports = new LeaderboardsController();