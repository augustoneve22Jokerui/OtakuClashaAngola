const BaseService = require('../../core/base/BaseService');
const quizRepository = require('./quiz.repository');
const questionsService = require('../questions/questions.service');
const matchesService = require('../matches/matches.service');
const AppError = require('../../core/errors/AppError');
const { MatchTypes } = require('../../core/constants/MatchTypes');
const XPCalculator = require('../../utils/XPCalculator');
const logger = require('../../config/logger');

/**
 * QuizService - Gerencia o fluxo de jogo dos modos de Quiz (Solo).
 */
class QuizService extends BaseService {
  constructor() {
    super(quizRepository);
  }

  /**
   * Inicializa uma nova sessão de quiz para um usuário.
   * @param {string} userId - ID do usuário.
   * @param {Object} config - { animeId, mode, difficulty }
   */
  async startSession(userId, config) {
    const { animeId, mode, difficulty } = config;

    // 1. Verifica se o usuário já tem uma sessão ativa no banco (Match IN_PROGRESS)
    const pendingId = await this.repository.hasPendingSession(userId);
    if (pendingId) {
      throw AppError.conflict('Você já possui uma sessão de quiz em andamento.');
    }

    // 2. Busca o conjunto de questões via QuestionsService
    const questions = await questionsService.getRandomSet({
      animeId,
      difficulty,
      limit: mode === MatchTypes.BLITZ ? 5 : 10
    });

    // 3. Cria o registro da "Partida" no banco de dados para rastreamento
    // Usamos o matchesService para manter a consistência financeira e de histórico
    const match = await matchesService.initMatch({
      userId,
      type: mode || MatchTypes.QUICK_PLAY,
      entryFee: 0, // Quizzes solo casuais são gratuitos
      animeId
    });

    // 4. Estrutura o estado da sessão para o Cache (Redis)
    const sessionState = {
      id: match.id,
      userId,
      mode,
      questions: questions.map(q => ({
        id: q.id,
        points: q.points,
        answered: false,
        correct: null
      })),
      currentIndex: 0,
      score: 0,
      correctCount: 0,
      startTime: Date.now(),
      totalTimeMs: 0
    };

    // 5. Salva no cache e retorna as questões (sem as respostas corretas)
    await this.repository.saveActiveSession(match.id, sessionState);

    // Mapeia para o DTO (será feito no controller, aqui enviamos o dado puro sanitizado)
    return {
      sessionId: match.id,
      questions: questions.map(q => ({
        id: q.id,
        text: q.question_text,
        category: q.category,
        timeLimit: q.time_limit,
        options: q.options.map(opt => ({ id: opt.id, text: opt.text }))
      }))
    };
  }

  /**
   * Processa a resposta enviada para uma questão específica.
   */
  async submitAnswer(userId, data) {
    const { sessionId, questionId, optionId, responseTimeMs } = data;

    // 1. Recupera sessão do cache
    const session = await this.repository.getActiveSession(sessionId);
    if (!session || session.userId !== userId) {
      throw AppError.notFound('Sessão de quiz não encontrada ou expirada.');
    }

    // 2. Localiza a questão na sessão
    const questionIndex = session.questions.findIndex(q => q.id === questionId);
    if (questionIndex === -1 || session.questions[questionIndex].answered) {
      throw AppError.badRequest('Questão inválida ou já respondida.');
    }

    // 3. Valida a resposta via QuestionsService
    const validation = await questionsService.validateAnswer(questionId, optionId);

    // 4. Atualiza o estado da sessão
    session.questions[questionIndex].answered = true;
    session.questions[questionIndex].correct = validation.isCorrect;
    session.totalTimeMs += responseTimeMs;

    if (validation.isCorrect) {
      session.score += session.questions[questionIndex].points;
      session.correctCount += 1;
    }

    session.currentIndex += 1;

    // 5. Salva estado atualizado no cache
    await this.repository.saveActiveSession(sessionId, session);

    return {
      isCorrect: validation.isCorrect,
      correctOptionId: validation.correctOptionId,
      currentScore: session.score,
      isLast: session.currentIndex === session.questions.length
    };
  }

  /**
   * Finaliza a sessão, persiste no banco e distribui XP.
   */
  async finishSession(userId, sessionId) {
    const session = await this.repository.getActiveSession(sessionId);
    if (!session) throw AppError.notFound('Sessão não localizada.');

    try {
      // 1. Calcula XP final ganho
      const earnedXP = XPCalculator.calculateMatchXP({
        correctAnswers: session.correctCount,
        totalQuestions: session.questions.length,
        matchType: session.mode,
        isWinner: session.correctCount > (session.questions.length / 2), // Vitória simbólica em modo solo
        avgResponseTime: session.totalTimeMs / session.questions.length
      });

      // 2. Persiste resultados no banco (Matches & MatchPlayers) via MatchService
      // Formatamos o array de resultados conforme esperado pelo MatchService
      const results = [{
        userId,
        score: session.score,
        correctAnswers: session.correctCount,
        avgTime: session.totalTimeMs / session.questions.length
      }];

      await matchesService.finishAndReward(sessionId, results);

      // 3. Limpa o cache
      await this.repository.deleteActiveSession(sessionId);

      logger.info(`[QuizService] Sessão ${sessionId} finalizada para o usuário ${userId}. XP: ${earnedXP}`);

      return {
        totalScore: session.score,
        correctAnswers: session.correctCount,
        totalQuestions: session.questions.length,
        earnedXP
      };
    } catch (error) {
      logger.error(`[QuizService] Falha ao finalizar sessão: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtém estatísticas rápidas do usuário no Quiz.
   */
  async getQuickStats(userId) {
    const recent = await this.repository.getRecentUserSessions(userId, 5);
    return {
      recentSessions: recent
    };
  }
}

module.exports = new QuizService();