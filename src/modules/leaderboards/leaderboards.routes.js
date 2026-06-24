/**
 * 🛣️ OTAKU CLASH ANGOLA - LEADERBOARDS ROUTES
 * Versão: 2.0.0 - Enterprise Secured
 * Descrição: Endpoints para consulta de rankings globais, sazonais e por categoria.
 */

const express = require('express');
const leaderboardsController = require('./leaderboards.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');
const validationMiddleware = require('../../middlewares/validation.middleware');
const { Roles } = require('../../core/constants/Roles');
const CommonSchema = require('../../validators/common.schema');
const { z } = require('zod');

const router = express.Router();

/**
 * ==================================================
 * ROTAS PÚBLICAS / SEMI-PÚBLICAS
 * (Acessíveis para visualização de rankings)
 * ==================================================
 */

/**
 * 🌍 RANKING GLOBAL DE XP (PAGINADO)
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
 * 📅 RANKING PERIÓDICO (DIÁRIO, SEMANAL, MENSAL)
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
 * 🛡️ ELITE DE CLÃS (RANKING DE GUILDAS)
 * GET /api/v1/leaderboards/guilds
 */
router.get(
  '/guilds',
  validationMiddleware({
    query: z.object({
      limit: z.coerce.number().int().min(1).max(50).default(20)
    })
  }),
  leaderboardsController.safe(leaderboardsController.getGuilds)
);

/**
 * 🔥 RANKING DE ESPECIALISTAS POR ANIME
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

/**
 * ==================================================
 * ROTAS PRIVADAS (PLAYER / ADMIN)
 * ==================================================
 */

/**
 * 🆔 POSIÇÃO ATUAL DO UTILIZADOR AUTENTICADO
 * GET /api/v1/leaderboards/me
 */
router.get(
  '/me',
  authMiddleware,
  leaderboardsController.safe(leaderboardsController.getMyRank)
);

/**
 * 🧹 MANUTENÇÃO: LIMPAR CACHE DE RANKINGS (ADMIN ONLY)
 * POST /api/v1/leaderboards/admin/clear-cache
 */
router.post(
  '/admin/clear-cache',
  authMiddleware,
  roleMiddleware(Roles.ADMIN),
  leaderboardsController.safe(leaderboardsController.clearCache)
);

module.exports = router;