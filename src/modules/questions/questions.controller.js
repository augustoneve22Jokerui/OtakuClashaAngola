const BaseController = require('../../core/base/BaseController');
const questionsService = require('./questions.service');
const QuestionsDTO = require('./questions.dto');

/**
 * QuestionsController - Controlador para gestão e consulta do banco de questões do quiz.
 */
class QuestionsController extends BaseController {
  constructor() {
    super();
  }

  /**
   * Obtém um conjunto de questões aleatórias para iniciar uma sessão de quiz.
   * GET /api/v1/questions/random
   */
  async getRandomSet(req, res) {
    const { animeId, difficulty, limit, category } = req.query;

    const questions = await questionsService.getRandomSet({
      animeId: animeId ? parseInt(animeId) : null,
      difficulty: difficulty ? parseInt(difficulty) : null,
      limit: limit ? parseInt(limit) : 10,
      category
    });

    const transformedQuestions = QuestionsDTO.transformMany(questions);

    return this.success(res, transformedQuestions, 'Set de questões gerado com sucesso.');
  }

  /**
   * Lista as questões com detalhes técnicos para o painel administrativo.
   * GET /api/v1/questions/admin/list
   */
  async listAdmin(req, res) {
    const { page, limit, animeId } = req.query;

    const result = await questionsService.listForAdmin({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      animeId: animeId ? parseInt(animeId) : null
    });

    const transformedItems = result.items.map(item => QuestionsDTO.transformAdmin(item));

    return this.paginate(res, transformedItems, result.pagination);
  }

  /**
   * Cria uma nova questão manualmente (Operação restrita a ADMIN/MODERATOR).
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
      options 
    } = req.body;

    const questionData = {
      anime_id,
      character_id,
      question_text,
      difficulty_level,
      category,
      points,
      time_limit,
      created_by: req.user.id
    };

    const newQuestion = await questionsService.createWithOptions(questionData, options);

    return this.created(res, QuestionsDTO.transform(newQuestion), 'Questão e opções criadas com sucesso.');
  }

  /**
   * Obtém os detalhes de uma única questão.
   * GET /api/v1/questions/:id
   */
  async getDetails(req, res) {
    const { id } = req.params;
    
    const question = await questionsService.findById(id);
    const options = await questionsService.repository.getOptionsByQuestionId(id);
    
    return this.success(res, QuestionsDTO.transformDetails(question, options));
  }

  /**
   * Remove uma questão do banco de dados (Operação restrita).
   * DELETE /api/v1/questions/:id
   */
  async delete(req, res) {
    const { id } = req.params;

    await questionsService.deleteQuestion(id);

    return this.noContent(res);
  }

  /**
   * Valida uma resposta enviada (Utilizado em modos onde a validação é imediata via HTTP).
   * POST /api/v1/questions/:id/validate
   */
  async validate(req, res) {
    const { id: questionId } = req.params;
    const { optionId } = req.body;

    const result = await questionsService.validateAnswer(questionId, optionId);

    return this.success(res, result, result.isCorrect ? 'Resposta correta!' : 'Resposta incorreta.');
  }
}

module.exports = new QuestionsController();