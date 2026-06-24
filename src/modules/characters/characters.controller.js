/**
 * 👤 OTAKU CLASH ANGOLA - CHARACTERS CONTROLLER
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Gerencia as requisições de personagens, curadoria e dados para o Quiz.
 */

const BaseController = require('../../core/base/BaseController');
const charactersService = require('./characters.service');

class CharactersController extends BaseController {
  constructor() {
    super();
  }

  /**
   * 📑 LISTAGEM DE PERSONAGENS (FILTROS + PAGINAÇÃO)
   * GET /api/v1/characters
   */
  async list(req, res) {
    const { search, animeId, page, limit } = req.query;

    const result = await charactersService.listCharacters({
      search,
      animeId: animeId ? parseInt(animeId) : null,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10
    });

    // Retorna utilizando o padrão de paginação da BaseController
    return this.paginate(res, result.items, result.pagination);
  }

  /**
   * 🔍 OBTÉM DETALHES COMPLETOS DE UM PERSONAGEM
   * GET /api/v1/characters/:id
   */
  async getDetails(req, res) {
    const { id } = req.params;

    const character = await charactersService.getCharacterDetails(id);

    return this.success(res, character, 'Detalhes do personagem recuperados.');
  }

  /**
   * 🎬 LISTA PERSONAGENS DE UM ANIME ESPECÍFICO
   * GET /api/v1/characters/anime/:animeId
   */
  async getByAnime(req, res) {
    const { animeId } = req.params;

    const characters = await charactersService.repository.findByAnimeId(parseInt(animeId));

    return this.success(res, characters, `Personagens vinculados à obra ${animeId} recuperados.`);
  }

  /**
   * 🎲 OBTÉM PERSONAGENS ALEATÓRIOS (MOTOR DE QUIZ)
   * GET /api/v1/characters/random
   */
  async getRandom(req, res) {
    const { limit, excludeId } = req.query;

    const characters = await charactersService.getRandomForQuiz(
      parseInt(limit) || 4,
      excludeId || null
    );

    return this.success(res, characters, 'Sugestões de personagens aleatórios geradas.');
  }

  /**
   * 🛠️ SALVAR / ATUALIZAR PERSONAGEM (ADMIN ACTION)
   * POST /api/v1/characters OU PATCH /api/v1/characters/:id
   */
  async save(req, res) {
    const { id } = req.params; // Presente apenas em atualizações
    const charData = {
      name: req.body.name,
      anime_id: req.body.anime_id ? parseInt(req.body.anime_id) : null,
      mal_id: req.body.mal_id ? parseInt(req.body.mal_id) : null,
      role: req.body.role,
      about: req.body.about
    };

    // Ficheiro de imagem interceptado pelo multer na rota
    const imageFile = req.file;

    const result = await charactersService.upsertCharacter(id, charData, imageFile);

    return id 
      ? this.success(res, result, 'Registo do personagem atualizado.')
      : this.created(res, result, 'Novo personagem integrado ao catálogo.');
  }

  /**
   * 🗑️ REMOVER PERSONAGEM
   * DELETE /api/v1/characters/:id
   */
  async delete(req, res) {
    const { id } = req.params;

    const deleted = await charactersService.delete(id);

    if (!deleted) {
      const AppError = require('../../core/errors/AppError');
      throw AppError.notFound('Personagem não encontrado para remoção.');
    }

    return this.noContent(res);
  }

  /**
   * 📊 MÉTRICAS DE PERSONAGENS (ADMIN)
   * GET /api/v1/characters/admin/stats
   */
  async getStats(req, res) {
    const stats = await charactersService.getMetrics();
    return this.success(res, stats, 'Métricas de personagens calculadas.');
  }
}

module.exports = new CharactersController();