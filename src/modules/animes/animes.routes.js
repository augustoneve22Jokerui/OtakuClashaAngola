const express = require('express');
const animesController = require('./animes.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');
const validationMiddleware = require('../../middlewares/validation.middleware');
const cacheMiddleware = require('../../middlewares/cache.middleware');
const CommonSchema = require('../../validators/common.schema');
const { Roles } = require('../../core/constants/Roles');
const { z } = require('zod');

const router = express.Router();

/**
 * Rotas Protegidas - Requerem login
 */
router.use(authMiddleware);

/**
 * Listar animes com filtros e paginação
 * GET /api/v1/animes
 */
router.get(
  '/',
  validationMiddleware({
    query: CommonSchema.pagination.extend({
      genre: z.string().optional(),
      year: z.coerce.number().optional(),
      type: z.string().optional(),
      search: z.string().optional(),
      orderBy: z.enum(['score', 'title', 'year', 'created_at']).default('score'),
      order: z.enum(['ASC', 'DESC']).default('DESC')
    })
  }),
  animesController.safe(animesController.list)
);

/**
 * Lista de animes mais populares (Top Rated)
 * GET /api/v1/animes/top
 */
router.get(
  '/top',
  cacheMiddleware(3600), // Cache de 1 hora
  animesController.safe(animesController.getTop)
);

/**
 * Lista de gêneros disponíveis no catálogo
 * GET /api/v1/animes/genres
 */
router.get(
  '/genres',
  cacheMiddleware(86400), // Cache de 24 horas
  animesController.safe(animesController.getGenres)
);

/**
 * Detalhes completos de um anime específico
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
 * ROTA ADMINISTRATIVA: Sincronização manual via MAL ID
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