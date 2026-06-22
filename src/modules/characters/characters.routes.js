const express = require('express');
const charactersController = require('./characters.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const validationMiddleware = require('../../middlewares/validation.middleware');
const CommonSchema = require('../../validators/common.schema');
const { z } = require('zod');

const router = express.Router();

/**
 * Todas as rotas de personagens exigem autenticação prévia.
 */
router.use(authMiddleware);

/**
 * Listar personagens com busca e paginação.
 * GET /api/v1/characters
 */
router.get(
  '/',
  validationMiddleware({
    query: CommonSchema.pagination.extend({
      search: z.string().optional()
    })
  }),
  charactersController.safe(charactersController.list)
);

/**
 * Obter personagens aleatórios para o Quiz ou Destaque.
 * GET /api/v1/characters/random
 */
router.get(
  '/random',
  validationMiddleware({
    query: z.object({
      limit: z.coerce.number().int().min(1).max(20).default(4),
      animeId: CommonSchema.numericId.optional()
    })
  }),
  charactersController.safe(charactersController.getRandom)
);

/**
 * Listar todos os personagens de um anime específico.
 * GET /api/v1/characters/anime/:animeId
 */
router.get(
  '/anime/:animeId',
  validationMiddleware({
    params: z.object({ animeId: CommonSchema.numericId })
  }),
  charactersController.safe(charactersController.getByAnime)
);

/**
 * Detalhes de um personagem específico.
 * GET /api/v1/characters/:id
 */
router.get(
  '/:id',
  validationMiddleware({
    params: z.object({ id: CommonSchema.numericId })
  }),
  charactersController.safe(charactersController.getDetails)
);

module.exports = router;