const BaseController = require('../../core/base/BaseController');
const leaderboardsService = require('./leaderboards.service');

/**
 * LeaderboardsController - Gerencia os endpoints de consulta a rankings e classificações.
 */
class LeaderboardsController extends BaseController {
  constructor() {
    super();
  }

  /**
   * Retorna o ranking global de jogadores por XP total.
   * GET /api/v1/leaderboards/global
   */
  async getGlobal(req, res) {
    const { page, limit } = req.query;

    const result = await leaderboardsService.getGlobalRanking({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50
    });

    // Como o ranking global pode ter milhares de registros, usamos paginação
    // O count total para o ranking global é o total de perfis no sistema
    const total = await leaderboardsService.repository.count();

    return this.paginate(res, result, {
      total,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50
    });
  }

  /**
   * Retorna rankings baseados em desempenho temporal (Diário, Semanal ou Mensal).
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
   * Retorna o ranking de clãs (Guildas) baseado em XP acumulado.
   * GET /api/v1/leaderboards/guilds
   */
  async getGuilds(req, res) {
    const { limit } = req.query;

    const ranking = await leaderboardsService.getGuildRanking(parseInt(limit) || 20);

    return this.success(res, ranking, 'Ranking de guildas recuperado.');
  }

  /**
   * Obtém a posição e estatísticas de ranking do usuário autenticado.
   * GET /api/v1/leaderboards/me
   */
  async getMyRank(req, res) {
    const userId = req.user.id;
    
    const myRank = await leaderboardsService.getUserRank(userId);
    
    return this.success(res, myRank, 'Sua posição no ranking foi recuperada.');
  }

  /**
   * Obtém o ranking de especialistas em um anime específico.
   * GET /api/v1/leaderboards/anime/:animeId
   */
  async getByAnime(req, res) {
    const { animeId } = req.params;
    const { limit } = req.query;

    const ranking = await leaderboardsService.getRankingByAnime(
      parseInt(animeId),
      parseInt(limit) || 50
    );

    return this.success(res, ranking, `Ranking para o anime ${animeId} recuperado.`);
  }
}

module.exports = new LeaderboardsController();