/**
 * ❓ OTAKU CLASH ANGOLA - QUESTIONS CONTROLLER
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Gerencia requisições de curadoria, banco de questões e validações de jogo.
 */

const BaseController = require('../../core/base/BaseController');
const questionsService = require('./questions.service');

class QuestionsController extends BaseController {
  constructor() {
    super();
  }

  /**
   * 🎲 OBTÉM QUESTÕES PARA JOGO (PLAYER VIEW)
   * GET /api/v1/questions/random
   */
  async getRandomSet(req, res) {
    const { animeId, difficulty, category, limit } = req.query;

    const questions = await questionsService.getRandomSet({
      animeId: animeId ? parseInt(animeId) : null,
      difficulty: difficulty ? parseInt(difficulty) : null,
      category,
      limit: parseInt(limit) || 10
    });

    // Retorna as questões sem o campo is_correct (protegido pelo repository/service)
    return this.success(res, questions, 'Desafio de quiz gerado com sucesso.');
  }

  /**
   * 📑 LISTAGEM DETALHADA PARA CURADORIA (ADMIN VIEW)
   * GET /api/v1/questions/admin/list
   */
  async listAdmin(req, res) {
    const { page, limit, animeId, search } = req.query;

    const result = await questionsService.listForAdmin({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      animeId: animeId ? parseInt(animeId) : null,
      search
    });

    // Utiliza o método de paginação padronizado para o Dashboard Admin
    return this.paginate(res, result.items, result.pagination);
  }

  /**
   * ✨ CRIAR NOVA QUESTÃO COM OPÇÕES
   * POST /api/v1/questions
   */
  async create(req, res) {
    const { 
      anime_id, 
      character_id, 
      question_text, 
      difficulty_level, 
      category, 
      points, 
      time_limit,
      options // Array: [{ text: string, isCorrect: boolean }]
    } = req.body;

    const questionData = {
      anime_id: anime_id ? parseInt(anime_id) : null,
      character_id: character_id ? parseInt(character_id) : null,
      question_text,
      difficulty_level: parseInt(difficulty_level) || 1,
      category,
      points: parseInt(points) || 10,
      time_limit: parseInt(time_limit) || 15,
      created_by: req.user.id
    };

    const newQuestion = await questionsService.createWithChoices(questionData, options);

    return this.created(res, newQuestion, 'Questão e alternativas publicadas com sucesso.');
  }

  /**
   * 🔍 OBTER DETALHES COMPLETOS (ADMIN VIEW)
   * GET /api/v1/questions/:id
   */
  async getDetails(req, res) {
    const { id } = req.params;
    
    // Busca questão incluindo quais são as opções corretas para revisão admin
    const question = await questionsService.repository.findByIdWithCorrect(id);
    
    if (!question) {
      const AppError = require('../../core/errors/AppError');
      throw AppError.notFound('Questão não localizada no banco de dados.');
    }
    
    return this.success(res, question, 'Ficha técnica da questão recuperada.');
  }

  /**
   * ✍️ ATUALIZAR QUESTÃO E ALTERNATIVAS
   * PATCH /api/v1/questions/:id
   */
  async update(req, res) {
    const { id } = req.params;
    const { options, ...updateData } = req.body;

    // Converte tipos se presentes
    if (updateData.anime_id) updateData.anime_id = parseInt(updateData.anime_id);
    if (updateData.difficulty_level) updateData.difficulty_level = parseInt(updateData.difficulty_level);

    const result = await questionsService.updateWithChoices(id, updateData, options);

    return this.success(res, result, 'Registo da questão atualizado com sucesso.');
  }

  /**
   * ✅ VALIDAR RESPOSTA (GAME ENGINE)
   * POST /api/v1/questions/:id/validate
   */
  async validate(req, res) {
    const { id: questionId } = req.params;
    const { optionId } = req.body;

    const result = await questionsService.validateAnswer(questionId, optionId);

    return this.success(res, result, result.isCorrect ? 'Resposta correcta!' : 'Resposta incorrecta.');
  }

  /**
   * 🗑️ REMOVER QUESTÃO
   * DELETE /api/v1/questions/:id
   */
  async delete(req, res) {
    const { id } = req.params;

    // A deleção de opções é feita em cascata via Service/DB
    const deleted = await questionsService.delete(id);

    if (!deleted) {
      const AppError = require('../../core/errors/AppError');
      throw AppError.notFound('Questão não encontrada ou já removida.');
    }

    return this.noContent(res);
  }

  /**
   * 📊 MÉTRICAS DE CONTEÚDO (ADMIN)
   * GET /api/v1/questions/admin/stats
   */
  async getStats(req, res) {
    const stats = await questionsService.getMetrics();
    return this.success(res, stats, 'Estatísticas de curadoria geradas.');
  }
}

module.exports = new QuestionsController();