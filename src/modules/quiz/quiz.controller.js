const BaseController = require('../../core/base/BaseController');
const quizService = require('./quiz.service');
const QuizDTO = require('./quiz.dto');

/**
 * QuizController - Controlador para sessões de Quiz Individuais.
 */
class QuizController extends BaseController {
  constructor() {
    super();
  }

  /**
   * Inicia uma nova sessão de quiz individual.
   * POST /api/v1/quiz/start
   */
  async start(req, res) {
    const userId = req.user.id;
    const { anime_id, mode, difficulty } = req.body;

    const sessionData = await quizService.startSession(userId, {
      animeId: anime_id,
      mode,
      difficulty
    });

    const transformed = QuizDTO.transformSession(sessionData);

    return this.created(res, transformed, 'Sessão de quiz iniciada.');
  }

  /**
   * Submete uma resposta para a questão atual da sessão.
   * POST /api/v1/quiz/submit
   */
  async submitAnswer(req, res) {
    const userId = req.user.id;
    const { session_id, question_id, option_id, response_time_ms } = req.body;

    const result = await quizService.submitAnswer(userId, {
      sessionId: session_id,
      questionId: question_id,
      optionId: option_id,
      responseTimeMs: response_time_ms
    });

    return this.success(res, result, result.isCorrect ? 'Resposta correta!' : 'Resposta incorreta.');
  }

  /**
   * Finaliza a sessão de quiz e processa recompensas.
   * POST /api/v1/quiz/finish
   */
  async finish(req, res) {
    const userId = req.user.id;
    const { session_id } = req.body;

    const result = await quizService.finishSession(userId, session_id);

    return this.success(res, result, 'Sessão finalizada com sucesso.');
  }

  /**
   * Obtém estatísticas e histórico de quizzes do usuário.
   * GET /api/v1/quiz/me/stats
   */
  async getMyStats(req, res) {
    const userId = req.user.id;
    
    const stats = await quizService.getQuickStats(userId);
    
    return this.success(res, stats, 'Estatísticas de quiz recuperadas.');
  }

  /**
   * Abandona uma sessão ativa (remove do cache e marca partida como encerrada).
   * DELETE /api/v1/quiz/abandon/:sessionId
   */
  async abandon(req, res) {
    const userId = req.user.id;
    const { sessionId } = req.params;

    // Lógica de abandono: deleta do cache e atualiza status no banco via MatchesService
    await quizService.repository.deleteActiveSession(sessionId);
    
    // Import direto para evitar dependência circular pesada se houver
    const matchesService = require('../matches/matches.service');
    await matchesService.update(sessionId, { status: 'FINISHED' });

    return this.noContent(res);
  }
}

module.exports = new QuizController();