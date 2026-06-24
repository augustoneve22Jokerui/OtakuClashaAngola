/**
 * 🛣️ OTAKU CLASH ANGOLA - WALLETS ROUTES
 * Versão: 2.0.0 - Enterprise Secured
 * Descrição: Endpoints para gestão de saldos, saques e auditoria financeira.
 */

const express = require('express');
const walletsController = require('./wallets.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');
const validationMiddleware = require('../../middlewares/validation.middleware');
const { Roles } = require('../../core/constants/Roles');
const CommonSchema = require('../../validators/common.schema');
const { z } = require('zod');

const router = express.Router();

/**
 * 🔒 PROTEÇÃO DE SESSÃO
 * Todas as rotas de carteira exigem utilizador autenticado.
 */
router.use(authMiddleware);

/**
 * ==================================================
 * ROTAS DE UTILIZADOR (PLAYER)
 * ==================================================
 */

/**
 * 💰 CONSULTAR PRÓPRIO SALDO
 * GET /api/v1/wallets/balance
 */
router.get(
  '/balance',
  walletsController.safe(walletsController.getMyBalance)
);

/**
 * 💸 SOLICITAR LEVANTAMENTO (WITHDRAWAL)
 * POST /api/v1/wallets/withdraw
 */
router.post(
  '/withdraw',
  validationMiddleware({
    body: z.object({
      amount: z.coerce.number().positive('O montante deve ser superior a zero').min(1000, 'O saque mínimo é de 1000 AKZ'),
      bankAccount: z.string().min(10, 'Número de conta ou IBAN inválido'),
      bankName: z.string().min(2, 'Nome do banco é obrigatório')
    })
  }),
  walletsController.safe(walletsController.requestWithdrawal)
);

/**
 * ==================================================
 * ROTAS ADMINISTRATIVAS (STAFF ONLY)
 * ==================================================
 */

/**
 * 🔍 CONSULTAR SALDO DE TERCEIROS
 * GET /api/v1/wallets/admin/user/:userId
 */
router.get(
  '/admin/user/:userId',
  roleMiddleware(Roles.ADMIN, Roles.MODERADOR),
  validationMiddleware({
    params: z.object({ userId: CommonSchema.uuid })
  }),
  walletsController.safe(walletsController.getBalanceByAdmin)
);

/**
 * 📋 LISTAR TRANSAÇÕES GLOBAIS (AUDITORIA)
 * GET /api/v1/wallets/admin/transactions
 */
router.get(
  '/admin/transactions',
  roleMiddleware(Roles.ADMIN),
  validationMiddleware({
    query: CommonSchema.pagination
  }),
  walletsController.safe(walletsController.getAdminRecentTransactions)
);

/**
 * 🛠️ AJUSTE ADMINISTRATIVO DE SALDO (CRÍTICO)
 * POST /api/v1/wallets/admin/adjust
 */
router.post(
  '/admin/adjust',
  roleMiddleware(Roles.ADMIN),
  validationMiddleware({
    body: z.object({
      userId: CommonSchema.uuid,
      amount: z.coerce.number().positive('O montante do ajuste deve ser positivo'),
      type: z.enum(['CREDIT', 'DEBIT']),
      description: z.string().min(5, 'A justificativa do ajuste é obrigatória').max(255)
    })
  }),
  walletsController.safe(walletsController.adjustBalance)
);

module.exports = router;