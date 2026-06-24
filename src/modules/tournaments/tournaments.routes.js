/**
 * 🏆 OTAKU CLASH ANGOLA - TOURNAMENTS ROUTES
 * Versão: 2.0.0 - Enterprise Secured
 * Descrição: Endpoints para gestão de torneios oficiais, inscrições e controle operacional.
 */

const express = require('express');
const tournamentsController = require('./tournaments.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');
const validationMiddleware = require('../../middlewares/validation.middleware');
const { Roles } = require('../../core/constants/Roles');
const CommonSchema = require('../../validators/common.schema');
const { z } = require('zod');

const router = express.Router();

/**
 * 🔒 PROTEÇÃO DE SESSÃO
 * Todas as rotas de torneio exigem utilizador autenticado.
 */
router.use(authMiddleware);

/**
 * ==================================================
 * ROTAS DE UTILIZADOR (PLAYER ACTIONS)
 * ==================================================
 */

/**
 * 📑 LISTAR TORNEIOS DISPONÍVEIS
 * GET /api/v1/tournaments
 */
router.get(
  '/',
  validationMiddleware({
    query: CommonSchema.pagination.extend({
      status: z.enum(['REGISTRATION', 'IN_PROGRESS', 'FINISHED', 'CANCELLED']).optional(),
      animeId: z.coerce.number().int().optional()
    })
  }),
  tournamentsController.safe(tournamentsController.list)
);

/**
 * 🆔 MEU HISTÓRICO DE PARTICIPAÇÃO
 * GET /api/v1/tournaments/me/participation
 * Nota: Definida antes de /:id para evitar conflito de parâmetros.
 */
router.get(
  '/me/participation',
  tournamentsController.safe(tournamentsController.getMyTournaments)
);

/**
 * 🔍 CONSULTAR DETALHES E INSCRITOS
 * GET /api/v1/tournaments/:id
 */
router.get(
  '/:id',
  validationMiddleware({
    params: z.object({ id: CommonSchema.uuid })
  }),
  tournamentsController.safe(tournamentsController.getDetails)
);

/**
 * ✍️ REALIZAR INSCRIÇÃO (PAGAMENTO)
 * POST /api/v1/tournaments/:id/register
 */
router.post(
  '/:id/register',
  validationMiddleware({
    params: z.object({ id: CommonSchema.uuid })
  }),
  tournamentsController.safe(tournamentsController.register)
);

/**
 * 🏃 CANCELAR INSCRIÇÃO (ESTORNO)
 * DELETE /api/v1/tournaments/:id/unregister
 */
router.delete(
  '/:id/unregister',
  validationMiddleware({
    params: z.object({ id: CommonSchema.uuid })
  }),
  tournamentsController.safe(tournamentsController.unregister)
);

/**
 * ==================================================
 * ROTAS ADMINISTRATIVAS (STAFF ONLY)
 * ==================================================
 */

/**
 * ✨ CRIAR NOVO TORNEIO
 * POST /api/v1/tournaments
 */
router.post(
  '/',
  roleMiddleware(Roles.ADMIN, Roles.MODERADOR),
  validationMiddleware({
    body: z.object({
      name: z.string().min(5).max(100),
      description: z.string().optional(),
      anime_id: CommonSchema.numericId,
      min_level: z.number().int().min(1).default(1),
      max_participants: z.number().int().min(2).max(1000),
      entry_fee: z.number().min(0).default(0),
      prize_pool: z.number().min(0).default(0),
      registration_opens_at: z.string().datetime(),
      start_at: z.string().datetime(),
      banner_url: z.string().url().optional()
    })
  }),
  tournamentsController.safe(tournamentsController.save)
);

/**
 * ✍️ ATUALIZAR DADOS DO TORNEIO
 * PATCH /api/v1/tournaments/:id
 */
router.patch(
  '/:id',
  roleMiddleware(Roles.ADMIN, Roles.MODERADOR),
  validationMiddleware({
    params: z.object({ id: CommonSchema.uuid }),
    body: z.object({
      name: z.string().min(5).max(100).optional(),
      description: z.string().optional(),
      anime_id: z.coerce.number().int().optional(),
      min_level: z.number().int().min(1).optional(),
      max_participants: z.number().int().optional(),
      entry_fee: z.number().min(0).optional(),
      prize_pool: z.number().min(0).optional(),
      registration_opens_at: z.string().datetime().optional(),
      start_at: z.string().datetime().optional(),
      banner_url: z.string().url().optional()
    })
  }),
  tournamentsController.safe(tournamentsController.save)
);

/**
 * 🚦 ALTERAR ESTADO OPERACIONAL (EX: INICIAR TORNEIO)
 * PATCH /api/v1/tournaments/:id/status
 */
router.patch(
  '/:id/status',
  roleMiddleware(Roles.ADMIN, Roles.MODERADOR),
  validationMiddleware({
    params: z.object({ id: CommonSchema.uuid }),
    body: z.object({
      status: z.enum(['REGISTRATION', 'IN_PROGRESS', 'FINISHED', 'CANCELLED'])
    })
  }),
  tournamentsController.safe(tournamentsController.updateStatus)
);

module.exports = router;