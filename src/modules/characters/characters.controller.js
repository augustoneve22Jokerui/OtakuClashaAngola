const BaseController = require('../../core/base/BaseController');
const charactersService = require('./characters.service');

/**
 * CharactersController - Controlador para gestão e consulta de personagens.
 */
class CharactersController extends BaseController {
  constructor() {
    super();
  }

  /**
   * Lista personagens com paginação e busca textual.
   * GET /api/v1/characters
   */
  async list(req, res) {
    const { search, page, limit } = req.query;

    const result = await charactersService.listCharacters({
      search,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });

    return this.paginate(res, result.items, result.pagination);
  }

  /**
   * Obtém detalhes de um personagem específico.
   * GET /api/v1/characters/:id
   */
  async getDetails(req, res) {
    const { id } = req.params;
    const character = await charactersService.getCharacterDetails(id);
    return this.success(res, character, 'Detalhes do personagem recuperados.');
  }

  /**
   * Lista todos os personagens vinculados a um anime.
   * GET /api/v1/characters/anime/:animeId
   */
  async getByAnime(req, res) {
    const { animeId } = req.params;
    const characters = await charactersService.getByAnime(animeId);
    return this.success(res, characters, `Personagens do anime ${animeId} recuperados.`);
  }

  /**
   * Rota auxiliar para o sistema de Quiz: Busca personagens aleatórios.
   * GET /api/v1/characters/random
   */
  async getRandom(req, res) {
    const { limit, animeId } = req.query;
    const characters = await charactersService.getRandomForQuiz(
      parseInt(limit) || 4,
      animeId ? parseInt(animeId) : null
    );
    return this.success(res, characters, 'Personagens aleatórios recuperados.');
  }
}

module.exports = new CharactersController();