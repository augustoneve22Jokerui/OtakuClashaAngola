/**
 * 🎬 OTAKU CLASH ANGOLA - ANIMES CONTROLLER
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Gerencia requisições do catálogo de obras, filtros e sincronização.
 */

const BaseController = require('../../core/base/BaseController');
const animesService = require('./animes.service');

class AnimesController extends BaseController {
  constructor() {
    super();
  }

  /**
   * 📑 LISTAGEM DE ANIMES (COM FILTROS E PAGINAÇÃO)
   * GET /api/v1/animes
   */
  async list(req, res) {
    const { 
      page, 
      limit, 
      genre, 
      year, 
      type, 
      search,
      orderBy,
      order 
    } = req.query;

    const result = await animesService.listAnimes({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      genre,
      year: year ? parseInt(year) : null,
      type,
      search,
      orderBy: orderBy || 'score',
      order: order || 'DESC'
    });

    // Retorna utilizando o padrão de paginação da BaseController
    return this.paginate(res, result.items, result.pagination);
  }

  /**
   * 🔍 OBTÉM DETALHES COMPLETOS DE UMA OBRA
   * GET /api/v1/animes/:id
   */
  async getDetails(req, res) {
    const { id } = req.params;
    
    // O service já busca o anime e anexa os personagens vinculados
    const anime = await animesService.getAnimeDetails(id);
    
    return this.success(res, anime, 'Detalhes da obra recuperados com sucesso.');
  }

  /**
   * 🌟 LISTA ANIMES MAIS POPULARES (CACHED)
   * GET /api/v1/animes/top
   */
  async getTop(req, res) {
    const { limit } = req.query;
    
    const topAnimes = await animesService.getTopAnimes(parseInt(limit) || 10);
    
    return this.success(res, topAnimes, 'Ranking de obras populares recuperado.');
  }

  /**
   * 🏷️ LISTA TODOS OS GÊNEROS DO CATÁLOGO (CACHED)
   * GET /api/v1/animes/genres
   */
  async getGenres(req, res) {
    const genres = await animesService.getGenres();
    
    return this.success(res, genres, 'Lista de géneros sincronizada.');
  }

  /**
   * 🔄 SINCRONIZAÇÃO MANUAL (ADMIN ACTION)
   * POST /api/v1/animes/sync/:malId
   */
  async syncAnime(req, res) {
    const { malId } = req.params;
    
    // Triggers a sincronização profunda (Anime + Personagens + Questões Base)
    const result = await animesService.syncAnimeByMalId(parseInt(malId));
    
    return this.success(res, result, 'Obra sincronizada e integrada ao catálogo local.');
  }

  /**
   * 📊 MÉTRICAS TÉCNICAS DO CATÁLOGO (ADMIN)
   * GET /api/v1/animes/admin/stats
   */
  async getStats(req, res) {
    const stats = await animesService.getCatalogMetrics();
    
    return this.success(res, stats, 'Métricas do catálogo geradas.');
  }
}

module.exports = new AnimesController();