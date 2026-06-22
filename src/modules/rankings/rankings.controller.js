const BaseController = require('../../core/base/BaseController');
const rankingsService = require('./rankings.service');
const RankingsDTO = require('./rankings.dto');

/**
 * RankingsController - Gerencia as rotas de classificação competitiva (LP/Tiers).
 */
class RankingsController extends BaseController {
  constructor() {
    super();
  }

  /**
   * Obtém a lista dos melhores jogadores baseada em League Points (LP).
   * GET /api/v1/rankings/top
   */
  async getTopPlayers(req, res) {
    const { limit, page } = req.query;
    
    const topPlayers = await rankingsService.getTopPlayers(parseInt(limit) || 100);
    
    // Transforma os dados para a resposta
    const transformed = RankingsDTO.transformMany(topPlayers);

    return this.success(res, transformed, 'Ranking de elite recuperado com sucesso.');
  }

  /**
   * Obtém o perfil competitivo detalhado do usuário autenticado.
   * GET /api/v1/rankings/me
   */
  async getMyRank(req, res) {
    const userId = req.user.id;
    
    const rankProfile = await rankingsService.getUserRankProfile(userId);
    
    const transformed = RankingsDTO.transformProfile(rankProfile);

    return this.success(res, transformed, 'Seu status competitivo foi recuperado.');
  }

  /**
   * Obtém estatísticas de distribuição de tiers (Quantos % em cada Tier).
   * GET /api/v1/rankings/stats/distribution
   */
  async getTierDistribution(req, res) {
    const distribution = await rankingsService.repository.getTierDistribution();
    
    return this.success(res, distribution, 'Distribuição de tiers da temporada atual.');
  }

  /**
   * Inicia o processo de reset de temporada (Apenas ADMIN).
   * POST /api/v1/rankings/admin/reset-season
   */
  async resetSeason(req, res) {
    // A verificação de role é feita no middleware de rota, mas reforçamos a segurança aqui.
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ status: 'error', message: 'Ação restrita a administradores.' });
    }

    const result = await rankingsService.resetSeason();

    return this.success(res, result, 'A temporada foi resetada e os prêmios foram agendados para distribuição.');
  }
}

module.exports = new RankingsController();