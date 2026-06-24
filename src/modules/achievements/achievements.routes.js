/**
 * 🛣️ OTAKU CLASH ANGOLA - ACHIEVEMENTS ROUTES
 * Versão: 2.0.0 - Enterprise Secured
 * Descrição: Endpoints para consulta de progresso, catálogo de insígnias e curadoria.
 */

const express = require('express');
const achievementsController = require('./achievements.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');
const validationMiddleware = require('../../middlewares/validation.middleware');
const { Roles } = require('../../core/constants/Roles');
const CommonSchema = require('../../validators/common.schema');
const { z } = require('zod');

const router = express.Router();

/**
 * 🔒 PROTEÇÃO DE SESSÃO
 * Todas as rotas de conquistas exigem utilizador autenticado via JWT.
 */
router.use(authMiddleware);

/**
 * ==================================================
 * ROTAS DE UTILIZADOR (PLAYER VIEW)
 * ==================================================
 */

/**
 * 📑 LISTAR TODAS AS CONQUISTAS (STATUS DO PLAYER)
 * GET /api/v1/achievements
 */
router.get(
  '/',
  achievementsController.safe(achievementsController.listMyAchievements)
);

/**
 * 📊 MINHAS ESTATÍSTICAS DE PROGRESSO
 * GET /api/v1/achievements/stats
 */
router.get(
  '/stats',
  achievementsController.safe(achievementsController.getMyStats)
);

/**
 * 🔍 CONSULTAR CONQUISTAS DE OUTRO JOGADOR
 * GET /api/v1/achievements/user/:userId
 */
router.get(
  '/user/:userId',
  validationMiddleware({
    params: z.object({ userId: CommonSchema.uuid })
  }),
  achievementsController.safe(achievementsController.getByUserId)
);

/**
 * 🆔 DETALHES DE UMA CONQUISTA ESPECÍFICA
 * GET /api/v1/achievements/:id
 */
router.get(
  '/:id',
  validationMiddleware({
    params: z.object({ id: z.coerce.number().int().positive() })
  }),
  achievementsController.safe(achievementsController.getById)
);

/**
 * ==================================================
 * ROTAS ADMINISTRATIVAS (STAFF ONLY)
 * ==================================================
 */

/**
 * ✨ CRIAR NOVA CONQUISTA NO CATÁLOGO
 * POST /api/v1/achievements
 */
router.post(
  '/',
  roleMiddleware(Roles.ADMIN, Roles.MODERADOR),
  validationMiddleware({
    body: z.object({
      name: z.string().min(3).max(100),
      description: z.string().min(10).max(255),
      category: z.enum(['PROGRESSION', 'KNOWLEDGE', 'COMPETITIVE', 'ECONOMY', 'SOCIAL']),
      requirement_type: z.enum(['WIN_COUNT', 'XP_LEVEL', 'MATCH_COUNT', 'CORRECT_ANSWERS', 'BALANCE_TOTAL']),
      requirement_value: z.number().int().positive(),
      reward_xp: z.number().int().min(0).default(0),
      reward_coins: z.number().min(0).default(0),
      badge_url: z.string().url('URL da badge inválida').optional()
    })
  }),
  achievementsController.safe(achievementsController.create)
);

/**
 * ✍️ ATUALIZAR DADOS DE UMA CONQUISTA
 * PATCH /api/v1/achievements/:id
 */
router.patch(
  '/:id',
  roleMiddleware(Roles.ADMIN, Roles.MODERADOR),
  validationMiddleware({
    params: z.object({ id: z.coerce.number().int().positive() }),
    body: z.object({
      name: z.string().min(3).max(100).optional(),
      description: z.string().min(10).max(255).optional(),
      category: z.enum(['PROGRESSION', 'KNOWLEDGE', 'COMPETITIVE', 'ECONOMY', 'SOCIAL']).optional(),
      requirement_type: z.enum(['WIN_COUNT', 'XP_LEVEL', 'MATCH_COUNT', 'CORRECT_ANSWERS', 'BALANCE_TOTAL']).optional(),
      requirement_value: z.number().int().positive().optional(),
      reward_xp: z.number().int().min(0).optional(),
      reward_coins: z.number().min(0).optional(),
      badge_url: z.string().url().optional()
    })
  }),
  achievementsController.safe(achievementsController.update)
);

/**
 * 🗑️ REMOVER CONQUISTA DO CATÁLOGO
 * DELETE /api/v1/achievements/:id
 */
router.delete(
  '/:id',
  roleMiddleware(Roles.ADMIN),
  validationMiddleware({
    params: z.object({ id: z.coerce.number().int().positive() })
  }),
  achievementsController.safe(achievementsController.delete)
);

module.exports = router;