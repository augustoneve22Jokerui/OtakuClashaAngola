/**
 * 🛣️ OTAKU CLASH ANGOLA - TRANSACTIONS ROUTES
 * Versão: 2.0.0 - Enterprise Secured
 * Descrição: Definição de endpoints para extratos, resumos e auditoria financeira global.
 */

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
 * 🔒 PROTEÇÃO DE SESSÃO
 * Todas as rotas deste módulo exigem autenticação.
 */
router.use(authMiddleware);

/**
 * ==================================================
 * ROTAS ADMINISTRATIVAS (STAFF ONLY)
 * Definidas primeiro para evitar conflito com rotas dinâmicas /:id
 * ==================================================
 */

/**
 * 🌍 LEDGER FINANCEIRO GLOBAL (AUDITORIA)
 * GET /api/v1/transactions/admin/recent
 */
router.get(
  '/admin/recent',
  roleMiddleware(Roles.ADMIN, Roles.MODERADOR),
  validationMiddleware({
    query: CommonSchema.pagination.extend({
      type: z.string().optional(),
      status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED']).optional(),
      search: z.string().optional()
    })
  }),
  transactionsController.safe(transactionsController.getAdminRecent)
);

/**
 * ==================================================
 * ROTAS DE UTILIZADOR (PLAYER VIEW)
 * ==================================================
 */

/**
 * 📄 EXTRATO PESSOAL
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
 * 📊 RESUMO FINANCEIRO (CREDIT vs DEBIT)
 * GET /api/v1/transactions/me/summary
 */
router.get(
  '/me/summary',
  transactionsController.safe(transactionsController.getMySummary)
);

/**
 * 🔍 CONSULTAR DETALHES DE UMA TRANSAÇÃO
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
 * 🛑 CANCELAR TRANSAÇÃO PENDENTE (EX: DEPÓSITO OU SAQUE)
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