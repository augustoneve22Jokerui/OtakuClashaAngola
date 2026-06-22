const express = require('express');
const quizController = require('./quiz.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const validationMiddleware = require('../../middlewares/validation.middleware');
const QuizSchema = require('../../validators/quiz.schema');
const CommonSchema = require('../../validators/common.schema');
const { z } = require('zod');

const router = express.Router();

/**
 * Todas as rotas de Quiz exigem autenticação do usuário.
 */
router.use(authMiddleware);

/**
 * Iniciar uma nova sessão de quiz individual.
 * POST /api/v1/quiz/start
 */
router.post(
  '/start',
  validationMiddleware({ body: QuizSchema.start }),
  quizController.safe(quizController.start)
);

/**
 * Enviar resposta para a questão atual da sessão.
 * POST /api/v1/quiz/submit
 */
router.post(
  '/submit',
  validationMiddleware({ body: QuizSchema.submitAnswer }),
  quizController.safe(quizController.submitAnswer)
);

/**
 * Finalizar a sessão de quiz e computar resultados/XP.
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
 * Obter histórico e estatísticas de quiz do usuário logado.
 * GET /api/v1/quiz/me/stats
 */
router.get(
  '/me/stats',
  quizController.safe(quizController.getMyStats)
);

/**
 * Abandonar uma sessão ativa.
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