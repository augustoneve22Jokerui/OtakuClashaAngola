const express = require('express');
const transactionsController = require('./transactions.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');
const validationMiddleware = require('../../middlewares/validation.middleware');
const { Roles } = require('../../core/constants/Roles');
const CommonSchema = require('../../validators/common.schema');
const { z } = require('zod');

const router = express.Router();

/**
 * Todas as rotas de transações exigem autenticação do usuário.
 */
router.use(authMiddleware);

/**
 * Rota Administrativa (Apenas ADMIN)
 * Deve vir antes das rotas com parâmetro ID para evitar conflito.
 * GET /api/v1/transactions/admin/recent
 */
router.get(
  '/admin/recent',
  roleMiddleware(Roles.ADMIN),
  validationMiddleware({
    query: z.object({
      limit: z.coerce.number().int().min(1).max(100).default(50)
    })
  }),
  transactionsController.safe(transactionsController.getAdminRecent)
);

/**
 * Extrato de transações do usuário logado
 * GET /api/v1/transactions/me
 */
router.get(
  '/me',
  validationMiddleware({
    query: CommonSchema.pagination.extend({
      type: z.string().optional(),
      status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED']).optional()
    })
  }),
  transactionsController.safe(transactionsController.getMyHistory)
);

/**
 * Resumo financeiro do usuário (Total de entradas vs saídas)
 * GET /api/v1/transactions/me/summary
 */
router.get(
  '/me/summary',
  transactionsController.safe(transactionsController.getMySummary)
);

/**
 * Detalhes de uma transação específica
 * GET /api/v1/transactions/:id
 */
router.get(
  '/:id',
  validationMiddleware({
    params: z.object({ id: CommonSchema.uuid })
  }),
  transactionsController.safe(transactionsController.getDetails)
);

/**
 * Cancelar uma transação pendente
 * POST /api/v1/transactions/:id/cancel
 */
router.post(
  '/:id/cancel',
  validationMiddleware({
    params: z.object({ id: CommonSchema.uuid })
  }),
  transactionsController.safe(transactionsController.cancel)
);

module.exports = router;