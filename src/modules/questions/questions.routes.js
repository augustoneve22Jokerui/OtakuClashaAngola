/**
 * 🛣️ OTAKU CLASH ANGOLA - QUESTIONS ROUTES
 * Versão: 2.0.0 - Enterprise Secured
 * Descrição: Endpoints para curadoria do banco de questões, métricas e motor de jogo.
 */

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
 * 🔒 PROTEÇÃO DE SESSÃO
 * Todas as rotas de questões exigem utilizador autenticado.
 */
router.use(authMiddleware);

/**
 * ==================================================
 * ROTAS DE JOGO (PLAYER / ADMIN)
 * ==================================================
 */

/**
 * 🎲 OBTER CONJUNTO ALEATÓRIO PARA QUIZ
 * GET /api/v1/questions/random
 */
router.get(
  '/random',
  validationMiddleware({
    query: z.object({
      animeId: z.coerce.number().int().optional(),
      difficulty: z.coerce.number().int().min(1).max(5).optional(),
      category: z.enum(['ANIME', 'CHARACTER', 'PLOT', 'MUSIC']).optional(),
      limit: z.coerce.number().int().min(1).max(50).default(10)
    })
  }),
  questionsController.safe(questionsController.getRandomSet)
);

/**
 * ✅ VALIDAR RESPOSTA SÍNCRONA
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
 * ==================================================
 * ROTAS ADMINISTRATIVAS (STAFF ONLY)
 * ==================================================
 */

/**
 * 📑 LISTAGEM PARA CURADORIA (DETALHADA)
 * GET /api/v1/questions/admin/list
 */
router.get(
  '/admin/list',
  roleMiddleware(Roles.ADMIN, Roles.MODERADOR),
  validationMiddleware({
    query: CommonSchema.pagination.extend({
      animeId: z.coerce.number().int().optional(),
      search: z.string().optional()
    })
  }),
  questionsController.safe(questionsController.listAdmin)
);

/**
 * 📊 MÉTRICAS DE CONTEÚDO
 * GET /api/v1/questions/admin/stats
 */
router.get(
  '/admin/stats',
  roleMiddleware(Roles.ADMIN, Roles.MODERADOR),
  questionsController.safe(questionsController.getStats)
);

/**
 * ✨ CRIAR NOVA QUESTÃO COM ALTERNATIVAS
 * POST /api/v1/questions
 */
router.post(
  '/',
  roleMiddleware(Roles.ADMIN, Roles.MODERADOR),
  validationMiddleware({
    body: z.object({
      anime_id: z.coerce.number().int().positive().nullable(),
      character_id: z.coerce.number().int().positive().nullable().optional(),
      question_text: z.string().min(10).max(500),
      difficulty_level: z.number().int().min(1).max(5).default(1),
      category: z.enum(['ANIME', 'CHARACTER', 'PLOT', 'MUSIC']),
      points: z.number().int().min(5).max(100).default(10),
      time_limit: z.number().int().min(5).max(60).default(15),
      options: z.array(z.object({
        text: z.string().min(1).max(255),
        isCorrect: z.boolean()
      })).min(2).max(6) // Garante entre 2 e 6 opções
    })
  }),
  questionsController.safe(questionsController.create)
);

/**
 * 🔍 CONSULTAR QUESTÃO (INCLUI RESPOSTA CORRETA)
 * GET /api/v1/questions/:id
 */
router.get(
  '/:id',
  roleMiddleware(Roles.ADMIN, Roles.MODERADOR),
  validationMiddleware({
    params: z.object({ id: CommonSchema.uuid })
  }),
  questionsController.safe(questionsController.getDetails)
);

/**
 * ✍️ ATUALIZAR QUESTÃO E ALTERNATIVAS
 * PATCH /api/v1/questions/:id
 */
router.patch(
  '/:id',
  roleMiddleware(Roles.ADMIN, Roles.MODERADOR),
  validationMiddleware({
    params: z.object({ id: CommonSchema.uuid }),
    body: z.object({
      anime_id: z.coerce.number().int().positive().nullable().optional(),
      character_id: z.coerce.number().int().positive().nullable().optional(),
      question_text: z.string().min(10).max(500).optional(),
      difficulty_level: z.number().int().min(1).max(5).optional(),
      category: z.enum(['ANIME', 'CHARACTER', 'PLOT', 'MUSIC']).optional(),
      points: z.number().int().min(5).max(100).optional(),
      time_limit: z.number().int().min(5).max(60).optional(),
      options: z.array(z.object({
        text: z.string().min(1).max(255),
        isCorrect: z.boolean()
      })).min(2).max(6).optional()
    })
  }),
  questionsController.safe(questionsController.update)
);

/**
 * 🗑️ REMOVER QUESTÃO
 * DELETE /api/v1/questions/:id
 */
router.delete(
  '/:id',
  roleMiddleware(Roles.ADMIN),
  validationMiddleware({
    params: z.object({ id: CommonSchema.uuid })
  }),
  questionsController.safe(questionsController.delete)
);

module.exports = router;