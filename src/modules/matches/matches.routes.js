const express = require('express');
const matchesController = require('./matches.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const validationMiddleware = require('../../middlewares/validation.middleware');
const CommonSchema = require('../../validators/common.schema');
const { MatchTypes } = require('../../core/constants/MatchTypes');
const { z } = require('zod');

const router = express.Router();

/**
 * Todas as rotas de partidas exigem autenticação.
 */
router.use(authMiddleware);

/**
 * Inicializar uma nova partida/duelo.
 * POST /api/v1/matches
 */
router.post(
  '/',
  validationMiddleware({
    body: z.object({
      type: z.nativeEnum(MatchTypes).default(MatchTypes.QUICK_PLAY),
      entryFee: z.coerce.number().min(0).default(0),
      animeId: CommonSchema.numericId.optional()
    })
  }),
  matchesController.safe(matchesController.create)
);

/**
 * Entrar em uma partida via código de sala.
 * POST /api/v1/matches/join
 */
router.post(
  '/join',
  validationMiddleware({
    body: z.object({
      roomCode: z.string().length(6).toUpperCase()
    })
  }),
  matchesController.safe(matchesController.joinByCode)
);

/**
 * Obter histórico de partidas do usuário autenticado.
 * GET /api/v1/matches/history
 */
router.get(
  '/history',
  validationMiddleware({
    query: CommonSchema.pagination
  }),
  matchesController.safe(matchesController.getMyHistory)
);

/**
 * Detalhes de uma partida específica.
 * GET /api/v1/matches/:id
 */
router.get(
  '/:id',
  validationMiddleware({
    params: z.object({ id: CommonSchema.uuid })
  }),
  matchesController.safe(matchesController.getDetails)
);

/**
 * ROTA ADMINISTRATIVA: Finalização manual de partida.
 * PATCH /api/v1/matches/:id/finish
 */
router.patch(
  '/:id/finish',
  validationMiddleware({
    params: z.object({ id: CommonSchema.uuid }),
    body: z.object({
      results: z.array(z.object({
        userId: CommonSchema.uuid,
        score: z.number().int().min(0),
        correctAnswers: z.number().int().min(0),
        avgTime: z.number().min(0)
      }))
    })
  }),
  matchesController.safe(matchesController.manualFinish)
);

module.exports = router;