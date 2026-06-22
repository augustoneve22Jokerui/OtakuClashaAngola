const express = require('express');
const questionsController = require('./questions.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');
const validationMiddleware = require('../../middlewares/validation.middleware');
const { Roles } = require('../../core/constants/Roles');
const CommonSchema = require('../../validators/common.schema');
const { z } = require('zod');

const router = express.Router();

/**
 * Todas as rotas de questões exigem autenticação prévia.
 */
router.use(authMiddleware);

/**
 * Obter um conjunto de questões aleatórias para jogo.
 * GET /api/v1/questions/random
 */
router.get(
  '/random',
  validationMiddleware({
    query: z.object({
      animeId: CommonSchema.numericId.optional(),
      difficulty: z.coerce.number().int().min(1).max(5).optional(),
      limit: z.coerce.number().int().min(1).max(50).default(10),
      category: z.enum(['ANIME', 'CHARACTER', 'PLOT', 'MUSIC']).optional()
    })
  }),
  questionsController.safe(questionsController.getRandomSet)
);

/**
 * Validar uma resposta individual (Modo HTTP).
 * POST /api/v1/questions/:id/validate
 */
router.post(
  '/:id/validate',
  validationMiddleware({
    params: z.object({ id: CommonSchema.uuid }),
    body: z.object({
      optionId: CommonSchema.uuid
    })
  }),
  questionsController.safe(questionsController.validate)
);

/**
 * ROTAS ADMINISTRATIVAS (Restritas a MODERATOR e ADMIN)
 */

// Listagem detalhada para curadoria
router.get(
  '/admin/list',
  roleMiddleware(Roles.MODERADOR, Roles.ADMIN),
  validationMiddleware({
    query: CommonSchema.pagination.extend({
      animeId: CommonSchema.numericId.optional()
    })
  }),
  questionsController.safe(questionsController.listAdmin)
);

// Detalhes completos de uma questão (incluindo qual é a correta)
router.get(
  '/:id',
  roleMiddleware(Roles.MODERADOR, Roles.ADMIN),
  validationMiddleware({
    params: z.object({ id: CommonSchema.uuid })
  }),
  questionsController.safe(questionsController.getDetails)
);

// Criação de nova questão e opções
router.post(
  '/',
  roleMiddleware(Roles.MODERADOR, Roles.ADMIN),
  validationMiddleware({
    body: z.object({
      anime_id: CommonSchema.numericId.optional(),
      character_id: CommonSchema.numericId.optional(),
      question_text: z.string().min(10).max(500),
      difficulty_level: z.number().int().min(1).max(5).default(1),
      category: z.enum(['ANIME', 'CHARACTER', 'PLOT', 'MUSIC']),
      points: z.number().int().min(0).default(10),
      time_limit: z.number().int().min(5).max(60).default(15),
      options: z.array(z.object({
        text: z.string().min(1).max(200),
        isCorrect: z.boolean()
      })).min(2).max(6)
    })
  }),
  questionsController.safe(questionsController.create)
);

/**
 * ROTA EXCLUSIVA DE ADMIN
 */

// Remoção física de questão
router.delete(
  '/:id',
  roleMiddleware(Roles.ADMIN),
  validationMiddleware({
    params: z.object({ id: CommonSchema.uuid })
  }),
  questionsController.safe(questionsController.delete)
);

module.exports = router;