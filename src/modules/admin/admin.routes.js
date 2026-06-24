/**
 * 🛣️ OTAKU CLASH ANGOLA - ADMIN ROUTES
 * Versão: 2.0.0 - Enterprise Secured
 * Descrição: Definição de endpoints restritos à equipe administrativa e manutenção.
 */

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
 * 🔒 PROTEÇÃO GLOBAL DO MÓDULO
 * Todas as rotas abaixo exigem autenticação válida e Role de ADMIN.
 */
router.use(authMiddleware);
router.use(roleMiddleware(Roles.ADMIN));

/**
 * 📊 DASHBOARD OVERVIEW
 * Retorna contagens globais, usuários online e volume financeiro.
 * GET /admin/dashboard
 */
router.get(
  '/dashboard',
  adminController.safe(adminController.getDashboard)
);

/**
 * 🛡️ GESTÃO DE PERMISSÕES (RBAC)
 * Altera a role de um utilizador específico.
 * PATCH /admin/users/:userId/role
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
 * 📑 LOGS DE AUDITORIA
 * Lista todas as ações críticas realizadas por administradores.
 * GET /admin/audit-logs
 */
router.get(
  '/audit-logs',
  validationMiddleware({
    query: z.object({
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
      action: z.string().optional(),
      resourceType: z.string().optional()
    })
  }),
  adminController.safe(adminController.getAuditLogs)
);

/**
 * 🔍 INTEGRIDADE DO CATÁLOGO
 * Relatório de animes sem questões ou personagens.
 * GET /admin/catalog/health
 */
router.get(
  '/catalog/health',
  adminController.safe(adminController.getCatalogHealth)
);

/**
 * 🔄 SINCRONIZAÇÃO MANUAL (JIKAN)
 * Dispara o worker de sincronização para um anime específico ou temporada.
 * POST /admin/sync/animes
 */
router.post(
  '/sync/animes',
  validationMiddleware({
    body: z.object({
      malId: z.number().int().positive().optional()
    })
  }),
  adminController.safe(adminController.triggerAnimeSync)
);

/**
 * 🧹 MANUTENÇÃO DE INFRAESTRUTURA (CACHE)
 * Limpa o cache do Redis ou memória local via Dashboard.
 * POST /admin/maintenance/clear-cache
 */
router.post(
  '/maintenance/clear-cache',
  validationMiddleware({
    body: z.object({
      type: z.enum(['ALL', 'MATCHMAKING', 'SESSIONS', 'RANKINGS']).default('ALL')
    })
  }),
  adminController.safe(adminController.clearCache)
);

module.exports = router;