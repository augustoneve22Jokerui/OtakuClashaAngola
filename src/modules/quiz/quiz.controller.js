/**
 * 🎮 OTAKU CLASH ANGOLA - QUIZ CONTROLLER
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Gerencia o fluxo de requisições para sessões de quiz individual.
 */

const BaseController = require('../../core/base/BaseController');
const quizService = require('./quiz.service');

class QuizController extends BaseController {
  constructor() {
    super();
  }

  /**
   * 🚀 INICIAR SESSÃO DE QUIZ
   * POST /api/v1/quiz/start
   */
  async start(req, res) {
    const userId = req.user.id;
    const { anime_id, mode, difficulty } = req.body;

    // Inicia a sessão no service (cria Match no DB e estado no Cache)
    const sessionData = await quizService.startSession(userId, {
      animeId: anime_id,
      mode,
      difficulty: parseInt(difficulty) || 1
    });

    return this.created(res, sessionData, 'Desafio de quiz iniciado. Boa sorte!');
  }

  /**
   * ✅ SUBMETER RESPOSTA
   * POST /api/v1/quiz/submit
   */
  async submitAnswer(req, res) {
    const userId = req.user.id;
    const { session_id, question_id, option_id, response_time_ms } = req.body;

    const result = await quizService.submitAnswer(userId, {
      sessionId: session_id,
      questionId: question_id,
      optionId: option_id,
      responseTimeMs: parseInt(response_time_ms) || 0
    });

    const message = result.isCorrect ? 'Resposta correcta!' : 'Resposta incorrecta.';
    return this.success(res, result, message);
  }

  /**
   * 🏁 FINALIZAR SESSÃO
   * POST /api/v1/quiz/finish
   */
  async finish(req, res) {
    const userId = req.user.id;
    const { session_id } = req.body;

    const summary = await quizService.finishSession(userId, session_id);

    return this.success(res, summary, 'Sessão concluída com sucesso. Recompensas creditadas.');
  }

  /**
   * 📊 MEU HISTÓRICO DE QUIZ
   * GET /api/v1/quiz/me/stats
   */
  async getMyStats(req, res) {
    const userId = req.user.id;
    
    const stats = await quizService.getQuickStats(userId);
    
    return this.success(res, stats, 'Estatísticas de quiz recuperadas.');
  }

  /**
   * 🚫 ABANDONAR SESSÃO ATIVA
   * DELETE /api/v1/quiz/abandon/:sessionId
   */
  async abandon(req, res) {
    const userId = req.user.id;
    const { sessionId } = req.params;

    // Recupera a sessão para validar posse
    const session = await quizService.repository.getActiveSession(sessionId);
    
    if (session && session.userId === userId) {
      // 1. Limpa o cache volátil
      await quizService.repository.deleteActiveSession(sessionId);
      
      // 2. Atualiza o status da partida para FINISHED (Abandoned) no banco
      const matchesService = require('../matches/matches.service');
      await matchesService.repository.update(sessionId, { 
        status: 'FINISHED',
        ended_at: new Date()
      });
      
      return this.noContent(res);
    }

    const AppError = require('../../core/errors/AppError');
    throw AppError.notFound('Sessão activa não localizada para este utilizador.');
  }
}

module.exports = new QuizController();