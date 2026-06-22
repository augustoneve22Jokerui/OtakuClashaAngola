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
 * Todas as rotas de reports exigem autenticação prévia.
 */
router.use(authMiddleware);

/**
 * Rotas de Usuário (Públicas para qualquer autenticado)
 */

// Criar um novo relato (Denúncia, Bug ou Feedback)
router.post(
  '/',
  validationMiddleware({
    body: z.object({
      reported_id: CommonSchema.uuid.optional(),
      type: z.enum(['CHEATING', 'TOXICITY', 'BUG', 'FEEDBACK', 'INAPPROPRIATE_CONTENT', 'OTHER']),
      description: z.string().min(10).max(1000),
      metadata: z.record(z.any()).optional()
    })
  }),
  reportsController.safe(reportsController.create)
);

/**
 * Rotas Administrativas (Restritas a MODERATOR e ADMIN)
 */
router.use(roleMiddleware(Roles.MODERADOR, Roles.ADMIN));

// Listar todos os relatos com filtros e paginação
router.get(
  '/',
  validationMiddleware({
    query: CommonSchema.pagination.extend({
      status: z.enum(['PENDING', 'RESOLVED', 'DISMISSED']).optional(),
      type: z.string().optional()
    })
  }),
  reportsController.safe(reportsController.list)
);

// Obter resumo de pendências para dashboard
router.get(
  '/summary',
  reportsController.safe(reportsController.getSummary)
);

// Obter detalhes de um relato específico
router.get(
  '/:id',
  validationMiddleware({
    params: z.object({ id: CommonSchema.uuid })
  }),
  reportsController.safe(reportsController.getDetails)
);

// Resolver um relato (Alterar status)
router.patch(
  '/:id/resolve',
  validationMiddleware({
    params: z.object({ id: CommonSchema.uuid }),
    body: z.object({
      status: z.enum(['RESOLVED', 'DISMISSED'])
    })
  }),
  reportsController.safe(reportsController.resolve)
);

module.exports = router;