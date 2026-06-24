/**
 * 🎮 OTAKU CLASH ANGOLA - QUIZ SERVICE
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Orquestrador do motor de jogo solo, gestão de progresso e recompensas.
 */

const BaseService = require('../../core/base/BaseService');
const quizRepository = require('./quiz.repository');
const questionsService = require('../questions/questions.service');
const matchesService = require('../matches/matches.service');
const XPCalculator = require('../../utils/XPCalculator');
const AppError = require('../../core/errors/AppError');
const logger = require('../../config/logger');
const { MatchTypes } = require('../../core/constants/MatchTypes');

class QuizService extends BaseService {
  constructor() {
    super(quizRepository);
  }

  /**
   * 🚀 INICIA UMA NOVA SESSÃO DE QUIZ
   * Cria o registo da partida e inicializa o estado no cache.
   */
  async startSession(userId, config) {
    const { animeId, mode, difficulty = 1 } = config;

    // 1. Verifica se o utilizador já tem uma partida "presa" no banco
    const pendingMatchId = await this.repository.findActiveMatchId(userId);
    if (pendingMatchId) {
      throw AppError.conflict('Você já possui uma sessão de quiz em andamento. Finalize-a primeiro.');
    }

    // 2. Busca o conjunto de questões via QuestionsService
    const questions = await questionsService.getRandomSet({
      animeId,
      difficulty,
      limit: mode === MatchTypes.BLITZ ? 5 : 10
    });

    // 3. Inicializa a "Partida" (Match) no banco de dados para rastreamento
    // Solo quizzes não possuem entryFee por padrão na versão atual
    const match = await matchesService.initMatch({
      userId,
      type: mode || MatchTypes.QUICK_PLAY,
      entryFee: 0,
      animeId
    });

    // 4. Estrutura o estado da sessão para o Cache (Redis/Memory)
    const sessionState = {
      matchId: match.id,
      userId,
      mode: mode || MatchTypes.QUICK_PLAY,
      animeId,
      questions: questions.map(q => ({
        id: q.id,
        points: q.points,
        timeLimit: q.timeLimit,
        answered: false,
        isCorrect: null
      })),
      currentIndex: 0,
      totalScore: 0,
      correctCount: 0,
      startTime: Date.now(),
      answersLog: [] // Para auditoria anti-cheat
    };

    // 5. Persiste no cache e retorna o desafio (Sanitizado)
    await this.repository.saveActiveSession(match.id, sessionState);

    return {
      sessionId: match.id,
      totalQuestions: questions.length,
      questions: questions.map(q => ({
        id: q.id,
        text: q.text,
        category: q.category,
        timeLimit: q.timeLimit,
        options: q.options // Já vem sem o campo is_correct do repository
      }))
    };
  }

  /**
   * ✅ PROCESSA SUBMISSÃO DE RESPOSTA
   * Valida a alternativa e atualiza o estado em memória.
   */
  async submitAnswer(userId, payload) {
    const { sessionId, questionId, optionId, responseTimeMs } = payload;

    // 1. Recupera sessão ativa
    const session = await this.repository.getActiveSession(sessionId);
    if (!session || session.userId !== userId) {
      throw AppError.notFound('Sessão de jogo expirada ou inválida.');
    }

    // 2. Localiza a questão atual
    const qIndex = session.questions.findIndex(q => q.id === questionId);
    if (qIndex === -1 || session.questions[qIndex].answered) {
      throw AppError.badRequest('Esta pergunta já foi respondida ou é inválida para esta sessão.');
    }

    // 3. Validação Server-Side via QuestionsService
    const validation = await questionsService.validateAnswer(questionId, optionId);

    // 4. Atualiza o estado da sessão
    const currentQ = session.questions[qIndex];
    currentQ.answered = true;
    currentQ.isCorrect = validation.isCorrect;
    currentQ.responseTime = responseTimeMs;

    if (validation.isCorrect) {
      session.correctCount += 1;
      // Cálculo de pontuação com bônus de velocidade opcional
      let earnedPoints = currentQ.points;
      if (responseTimeMs < (currentQ.timeLimit * 1000) / 2) {
        earnedPoints = Math.floor(earnedPoints * 1.2); // +20% bônus de rapidez
      }
      session.totalScore += earnedPoints;
    }

    session.currentIndex += 1;
    session.answersLog.push({ questionId, optionId, isCorrect: validation.isCorrect });

    // 5. Salva estado atualizado no cache
    const isLast = session.currentIndex === session.questions.length;
    await this.repository.saveActiveSession(sessionId, session);

    return {
      isCorrect: validation.isCorrect,
      correctOptionId: validation.correctOptionId, // Para feedback visual no App
      currentScore: session.totalScore,
      isLast
    };
  }

  /**
   * 🏁 FINALIZA SESSÃO E COMPUTA RECOMPENSAS
   * Encerra a partida, calcula XP e limpa cache.
   */
  async finishSession(userId, sessionId) {
    const session = await this.repository.getActiveSession(sessionId);
    if (!session || session.userId !== userId) {
      throw AppError.notFound('Não foi possível localizar a sessão para encerramento.');
    }

    try {
      // 1. Cálculo de XP Final utilizando o Helper Centralizado
      const avgResponseTime = session.answersLog.length > 0 
        ? session.questions.reduce((acc, q) => acc + (q.responseTime || 0), 0) / session.questions.length 
        : 0;

      const earnedXP = XPCalculator.calculateMatchXP({
        correctAnswers: session.correctCount,
        totalQuestions: session.questions.length,
        matchType: session.mode,
        isWinner: session.correctCount >= (session.questions.length / 2),
        avgResponseTime
      });

      // 2. Persistência Final via MatchesService
      // Isso atualiza a tabela matches para FINISHED e credita XP/Prêmios
      const results = [{
        userId,
        score: session.totalScore,
        correctAnswers: session.correctCount,
        avgTime: avgResponseTime
      }];

      await matchesService.finishAndReward(sessionId, results);

      // 3. Limpeza de cache volátil
      await this.repository.deleteActiveSession(sessionId);

      logger.info(`[Quiz:Finish] Utilizador ${userId} concluiu sessão ${sessionId}. XP: ${earnedXP}`);

      return {
        totalScore: session.totalScore,
        performance: {
          correct: session.correctCount,
          total: session.questions.length,
          accuracy: ((session.correctCount / session.questions.length) * 100).toFixed(1) + '%'
        },
        rewards: {
          xp: earnedXP,
          coins: 0 // Solo casual não gera coins por padrão
        }
      };

    } catch (error) {
      logger.error(`[QuizService:Finish] Erro crítico: ${error.message}`);
      throw error;
    }
  }

  /**
   * 📊 OBTÉM ESTATÍSTICAS RÁPIDAS
   */
  async getQuickStats(userId) {
    const history = await this.repository.getRecentUserQuizzes(userId, 5);
    return {
      recentQuizzes: history
    };
  }
}

module.exports = new QuizService();