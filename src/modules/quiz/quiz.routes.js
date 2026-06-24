/**
 * 🎮 OTAKU CLASH ANGOLA - QUIZ ROUTES
 * Versão: 2.0.0 - Enterprise Secured
 * Descrição: Endpoints para gestão do ciclo de vida das sessões de quiz individual.
 */

const express = require('express');
const quizController = require('./quiz.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const validationMiddleware = require('../../middlewares/validation.middleware');
const QuizSchema = require('../../validators/quiz.schema');
const CommonSchema = require('../../validators/common.schema');
const { z } = require('zod');

const router = express.Router();

/**
 * 🔒 PROTEÇÃO DE SESSÃO
 * Todas as rotas de jogo exigem utilizador autenticado via JWT.
 */
router.use(authMiddleware);

/**
 * ==================================================
 * ROTAS DE GAMEPLAY (PLAYER)
 * ==================================================
 */

/**
 * 🚀 INICIAR NOVA SESSÃO
 * Cria a partida no DB e inicializa o estado no Cache.
 * POST /api/v1/quiz/start
 */
router.post(
  '/start',
  validationMiddleware({ body: QuizSchema.start }),
  quizController.safe(quizController.start)
);

/**
 * ✅ SUBMETER RESPOSTA PARA QUESTÃO ATUAL
 * Valida a alternativa e atualiza score parcial.
 * POST /api/v1/quiz/submit
 */
router.post(
  '/submit',
  validationMiddleware({ body: QuizSchema.submitAnswer }),
  quizController.safe(quizController.submitAnswer)
);

/**
 * 🏁 FINALIZAR SESSÃO E COMPUTAR XP
 * Encerra a partida e credita recompensas.
 * POST /api/v1/quiz/finish
 */
router.post(
  '/finish',
  validationMiddleware({
    body: z.object({
      session_id: CommonSchema.uuid
    })
  }),
  quizController.safe(quizController.finish)
);

/**
 * 📊 MEU HISTÓRICO E ESTATÍSTICAS RECENTES
 * GET /api/v1/quiz/me/stats
 */
router.get(
  '/me/stats',
  quizController.safe(quizController.getMyStats)
);

/**
 * 🚫 ABANDONAR SESSÃO ACTIVA
 * Remove do cache e encerra a partida como inacabada.
 * DELETE /api/v1/quiz/abandon/:sessionId
 */
router.delete(
  '/abandon/:sessionId',
  validationMiddleware({
    params: z.object({
      sessionId: CommonSchema.uuid
    })
  }),
  quizController.safe(quizController.abandon)
);

module.exports = router;