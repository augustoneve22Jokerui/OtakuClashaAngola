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
 * Todas as rotas deste módulo são restritas a administradores ou moderadores.
 */
router.use(authMiddleware);
router.use(roleMiddleware(Roles.ADMIN, Roles.MODERADOR));

/**
 * Listar usuários com filtros e paginação
 * GET /api/v1/users
 */
router.get(
  '/',
  validationMiddleware({
    query: CommonSchema.pagination.extend({
      search: z.string().optional(),
      role: z.enum([Roles.ADMIN, Roles.MODERADOR, Roles.USUARIO]).optional()
    })
  }),
  usersController.safe(usersController.list)
);

/**
 * Obter registros recentes para o dashboard
 * GET /api/v1/users/admin/recent
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
 * Obter detalhes completos de um usuário (Perfil + Auth)
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
 * Suspender ou reativar conta de usuário
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