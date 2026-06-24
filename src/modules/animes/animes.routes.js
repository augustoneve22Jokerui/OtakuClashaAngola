/**
 * 🛣️ OTAKU CLASH ANGOLA - ANIMES ROUTES
 * Versão: 2.0.0 - Enterprise Secured
 * Descrição: Definição de endpoints para o catálogo de obras, rankings e curadoria.
 */

const express = require('express');
const animesController = require('./animes.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');
const validationMiddleware = require('../../middlewares/validation.middleware');
const { Roles } = require('../../core/constants/Roles');
const CommonSchema = require('../../validators/common.schema');
const { z } = require('zod');

const router = express.Router();

/**
 * 🔒 PROTEÇÃO DE SESSÃO
 * Todas as rotas de catálogo exigem utilizador autenticado.
 */
router.use(authMiddleware);

/**
 * ==================================================
 * ROTAS PÚBLICAS (PLAYER / ADMIN)
 * ==================================================
 */

/**
 * 📑 LISTAGEM DE ANIMES
 * GET /api/v1/animes
 */
router.get(
  '/',
  validationMiddleware({
    query: CommonSchema.pagination.extend({
      genre: z.string().optional(),
      year: z.coerce.number().int().optional(),
      type: z.enum(['TV', 'Movie', 'OVA', 'ONA', 'Special', 'Music']).optional(),
      search: z.string().optional(),
      orderBy: z.enum(['score', 'title', 'year', 'created_at']).default('score'),
      order: z.enum(['ASC', 'DESC']).default('DESC')
    })
  }),
  animesController.safe(animesController.list)
);

/**
 * 🏷️ LISTA DE GÉNEROS (CACHED)
 * GET /api/v1/animes/genres
 */
router.get(
  '/genres',
  animesController.safe(animesController.getGenres)
);

/**
 * 🌟 RANKING DE POPULARES (CACHED)
 * GET /api/v1/animes/top
 */
router.get(
  '/top',
  validationMiddleware({
    query: z.object({
      limit: z.coerce.number().int().min(1).max(50).default(10)
    })
  }),
  animesController.safe(animesController.getTop)
);

/**
 * 🔍 DETALHES DE UMA OBRA
 * GET /api/v1/animes/:id
 */
router.get(
  '/:id',
  validationMiddleware({
    params: z.object({ id: CommonSchema.numericId })
  }),
  animesController.safe(animesController.getDetails)
);

/**
 * ==================================================
 * ROTAS ADMINISTRATIVAS (STAFF ONLY)
 * ==================================================
 */

/**
 * 📊 MÉTRICAS DO CATÁLOGO (ADMIN DASHBOARD)
 * GET /api/v1/animes/admin/stats
 */
router.get(
  '/admin/stats',
  roleMiddleware(Roles.ADMIN, Roles.MODERADOR),
  animesController.safe(animesController.getStats)
);

/**
 * 🔄 SINCRONIZAÇÃO MANUAL (CRÍTICO)
 * POST /api/v1/animes/sync/:malId
 */
router.post(
  '/sync/:malId',
  roleMiddleware(Roles.ADMIN),
  validationMiddleware({
    params: z.object({ malId: CommonSchema.numericId })
  }),
  animesController.safe(animesController.syncAnime)
);

module.exports = router;