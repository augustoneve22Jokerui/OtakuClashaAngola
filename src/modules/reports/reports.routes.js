/**
 * 🛣️ OTAKU CLASH ANGOLA - REPORTS ROUTES
 * Versão: 2.0.0 - Enterprise Secured
 * Descrição: Endpoints para envio de denúncias, feedbacks e ferramentas de moderação STAFF.
 */

const express = require('express');
const reportsController = require('./reports.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');
const validationMiddleware = require('../../middlewares/validation.middleware');
const { Roles } = require('../../core/constants/Roles');
const CommonSchema = require('../../validators/common.schema');
const { z } = require('zod');

const router = express.Router();

/**
 * 🔒 PROTEÇÃO DE SESSÃO
 * Todas as rotas de reporte exigem utilizador autenticado via JWT.
 */
router.use(authMiddleware);

/**
 * ==================================================
 * ROTAS DE UTILIZADOR (PLAYER ACTIONS)
 * ==================================================
 */

/**
 * 📝 CRIAR NOVO RELATO (DENÚNCIA, BUG OU FEEDBACK)
 * POST /api/v1/reports
 */
router.post(
  '/',
  validationMiddleware({
    body: z.object({
      reported_id: CommonSchema.uuid.optional().nullable(),
      type: z.enum(['CHEATING', 'TOXICITY', 'BUG', 'FEEDBACK', 'INAPPROPRIATE_CONTENT', 'OTHER']),
      description: z.string().min(10, 'A descrição deve ter pelo menos 10 caracteres').max(1000),
      metadata: z.record(z.any()).optional()
    })
  }),
  reportsController.safe(reportsController.create)
);

/**
 * ==================================================
 * ROTAS ADMINISTRATIVAS (STAFF ONLY)
 * ==================================================
 */

/**
 * 📊 RESUMO DE PENDÊNCIAS (DASHBOARD WIDGET)
 * GET /api/v1/reports/summary
 */
router.get(
  '/summary',
  roleMiddleware(Roles.ADMIN, Roles.MODERADOR),
  reportsController.safe(reportsController.getSummary)
);

/**
 * 📑 LISTAR TODAS AS DENÚNCIAS (FILTRADO)
 * GET /api/v1/reports
 */
router.get(
  '/',
  roleMiddleware(Roles.ADMIN, Roles.MODERADOR),
  validationMiddleware({
    query: CommonSchema.pagination.extend({
      status: z.enum(['PENDING', 'RESOLVED', 'DISMISSED']).optional(),
      type: z.string().optional()
    })
  }),
  reportsController.safe(reportsController.list)
);

/**
 * 🔍 CONSULTAR DETALHES TÉCNICOS DE UM TICKET
 * GET /api/v1/reports/:id
 */
router.get(
  '/:id',
  roleMiddleware(Roles.ADMIN, Roles.MODERADOR),
  validationMiddleware({
    params: z.object({ id: CommonSchema.uuid })
  }),
  reportsController.safe(reportsController.getDetails)
);

/**
 * ✅ RESOLVER TICKET (VEREDITO DO MODERADOR)
 * PATCH /api/v1/reports/:id/resolve
 */
router.patch(
  '/:id/resolve',
  roleMiddleware(Roles.ADMIN, Roles.MODERADOR),
  validationMiddleware({
    params: z.object({ id: CommonSchema.uuid }),
    body: z.object({
      status: z.enum(['RESOLVED', 'DISMISSED']),
      resolution_note: z.string().min(5, 'A nota de resolução deve ser explicativa').max(500).optional()
    })
  }),
  reportsController.safe(reportsController.resolve)
);

module.exports = router;