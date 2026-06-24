/**
 * 🛣️ OTAKU CLASH ANGOLA - USERS ROUTES (ADMINISTRATION)
 * Versão: 2.0.0 - Enterprise Secured
 * Descrição: Definição de endpoints para gestão de utilizadores, moderação e KPIs.
 */

const express = require('express');
const usersController = require('./users.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');
const validationMiddleware = require('../../middlewares/validation.middleware');
const { Roles } = require('../../core/constants/Roles');
const CommonSchema = require('../../validators/common.schema');
const { z } = require('zod');

const router = express.Router();

/**
 * 🔒 PROTEÇÃO GLOBAL DO MÓDULO
 * Somente membros da STAFF (ADMIN/MODERATOR) podem aceder a estas rotas.
 */
router.use(authMiddleware);
router.use(roleMiddleware(Roles.ADMIN, Roles.MODERADOR));

/**
 * 📑 LISTAGEM GLOBAL DE UTILIZADORES
 * GET /api/v1/users
 */
router.get(
  '/',
  validationMiddleware({
    query: CommonSchema.pagination.extend({
      search: z.string().optional(),
      role: z.enum([Roles.ADMIN, Roles.MODERADOR, Roles.USUARIO]).optional(),
      status: z.enum(['online', 'offline']).optional()
    })
  }),
  usersController.safe(usersController.list)
);

/**
 * 📊 DASHBOARD WIDGET: UTILIZADORES RECENTES
 * GET /api/v1/users/admin/recent
 * Nota: Colocada antes de /:id para evitar conflito de parâmetros.
 */
router.get(
  '/admin/recent',
  validationMiddleware({
    query: z.object({
      limit: z.coerce.number().int().min(1).max(50).default(5)
    })
  }),
  usersController.safe(usersController.getRecent)
);

/**
 * 🛡️ VERIFICAR DISPONIBILIDADE DE USERNAME
 * GET /api/v1/users/check-username
 */
router.get(
  '/check-username',
  validationMiddleware({
    query: z.object({
      username: z.string().min(3).max(30),
      excludeId: CommonSchema.uuid.optional()
    })
  }),
  usersController.safe(usersController.checkUsername)
);

/**
 * 🔍 PERFIL DETALHADO (360º VIEW)
 * GET /api/v1/users/:id
 */
router.get(
  '/:id',
  validationMiddleware({
    params: z.object({ id: CommonSchema.uuid })
  }),
  usersController.safe(usersController.getDetails)
);

/**
 * 🏆 ESTATÍSTICAS DE PERFORMANCE DO JOGADOR
 * GET /api/v1/users/:id/stats
 */
router.get(
  '/:id/stats',
  validationMiddleware({
    params: z.object({ id: CommonSchema.uuid })
  }),
  usersController.safe(usersController.getStats)
);

/**
 * 🚫 MODERAÇÃO: SUSPENDER OU REATIVAR CONTA
 * PATCH /api/v1/users/:id/status
 */
router.patch(
  '/:id/status',
  validationMiddleware({
    params: z.object({ id: CommonSchema.uuid }),
    body: z.object({
      suspended: z.boolean(),
      reason: z.string().min(5).max(255).optional()
    })
  }),
  usersController.safe(usersController.toggleStatus)
);

module.exports = router;