const express = require('express');
const adminController = require('./admin.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');
const validationMiddleware = require('../../middlewares/validation.middleware');
const CommonSchema = require('../../validators/common.schema');
const { Roles } = require('../../core/constants/Roles');
const { z } = require('zod');

const router = express.Router();

/**
 * Proteção Global: Apenas usuários autenticados com papel ADMIN podem acessar este roteador.
 */
router.use(authMiddleware);
router.use(roleMiddleware(Roles.ADMIN));

/**
 * Dashboard Overview
 * GET /api/v1/admin/dashboard
 */
router.get(
  '/dashboard',
  adminController.safe(adminController.getDashboard)
);

/**
 * Gestão de Permissões de Usuário
 * PATCH /api/v1/admin/users/:userId/role
 */
router.patch(
  '/users/:userId/role',
  validationMiddleware({
    params: z.object({ 
      userId: CommonSchema.uuid 
    }),
    body: z.object({
      role: z.enum([Roles.ADMIN, Roles.MODERADOR, Roles.USUARIO])
    })
  }),
  adminController.safe(adminController.changeUserRole)
);

/**
 * Logs de Auditoria do Sistema
 * GET /api/v1/admin/audit-logs
 */
router.get(
  '/audit-logs',
  validationMiddleware({
    query: z.object({
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
      action: z.string().optional()
    })
  }),
  adminController.safe(adminController.getAuditLogs)
);

/**
 * Relatório de Integridade do Catálogo
 * GET /api/v1/admin/catalog/health
 */
router.get(
  '/catalog/health',
  adminController.safe(adminController.getCatalogHealth)
);

/**
 * Trigger de Sincronização Manual
 * POST /api/v1/admin/sync/animes
 */
router.post(
  '/sync/animes',
  adminController.safe(adminController.triggerAnimeSync)
);

module.exports = router;