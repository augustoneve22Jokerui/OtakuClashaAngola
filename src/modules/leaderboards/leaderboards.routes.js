const express = require('express');
const leaderboardsController = require('./leaderboards.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const validationMiddleware = require('../../middlewares/validation.middleware');
const CommonSchema = require('../../validators/common.schema');
const { z } = require('zod');

const router = express.Router();

/**
 * Ranking Global de Jogadores
 * GET /api/v1/leaderboards/global
 */
router.get(
  '/global',
  validationMiddleware({
    query: CommonSchema.pagination
  }),
  leaderboardsController.safe(leaderboardsController.getGlobal)
);

/**
 * Rankings Periódicos (Diário, Semanal, Mensal)
 * GET /api/v1/leaderboards/period/:type
 */
router.get(
  '/period/:type',
  validationMiddleware({
    params: z.object({
      type: z.enum(['daily', 'weekly', 'monthly'])
    }),
    query: z.object({
      limit: z.coerce.number().int().min(1).max(100).default(50)
    })
  }),
  leaderboardsController.safe(leaderboardsController.getPeriodic)
);

/**
 * Ranking de Guildas (Clãs)
 * GET /api/v1/leaderboards/guilds
 */
router.get(
  '/guilds',
  validationMiddleware({
    query: z.object({
      limit: z.coerce.number().int().min(1).max(100).default(20)
    })
  }),
  leaderboardsController.safe(leaderboardsController.getGuilds)
);

/**
 * Obter posição do usuário autenticado no ranking
 * GET /api/v1/leaderboards/me
 */
router.get(
  '/me',
  authMiddleware,
  leaderboardsController.safe(leaderboardsController.getMyRank)
);

/**
 * Ranking de especialistas por Anime
 * GET /api/v1/leaderboards/anime/:animeId
 */
router.get(
  '/anime/:animeId',
  validationMiddleware({
    params: z.object({
      animeId: CommonSchema.numericId
    }),
    query: z.object({
      limit: z.coerce.number().int().min(1).max(100).default(50)
    })
  }),
  leaderboardsController.safe(leaderboardsController.getByAnime)
);

module.exports = router;