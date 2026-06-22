const BaseController = require('../../core/base/BaseController');
const animesService = require('./animes.service');

/**
 * AnimesController - Controlador para gestão e consulta do catálogo de animes.
 */
class AnimesController extends BaseController {
  constructor() {
    super();
  }

  /**
   * Lista animes com paginação e filtros dinâmicos.
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

    return this.paginate(res, result.items, result.pagination);
  }

  /**
   * Obtém detalhes completos de um anime específico.
   * GET /api/v1/animes/:id
   */
  async getDetails(req, res) {
    const { id } = req.params;
    const anime = await animeService.getAnimeDetails(id);
    return this.success(res, anime);
  }

  /**
   * Obtém a lista de animes mais populares/bem avaliados.
   * GET /api/v1/animes/top
   */
  async getTop(req, res) {
    const topAnimes = await animesService.getTopAnimes();
    return this.success(res, topAnimes);
  }

  /**
   * Obtém a lista de todos os gêneros disponíveis no catálogo.
   * GET /api/v1/animes/genres
   */
  async getGenres(req, res) {
    const genres = await animesService.getGenres();
    return this.success(res, genres);
  }

  /**
   * Rota Administrativa: Sincroniza um anime específico via MAL ID.
   * POST /api/v1/animes/sync/:malId
   */
  async syncAnime(req, res) {
    const { malId } = req.params;
    const result = await animesService.syncAnimeByMalId(parseInt(malId));
    return this.success(res, result, 'Anime sincronizado com sucesso.');
  }
}

module.exports = new AnimesController();