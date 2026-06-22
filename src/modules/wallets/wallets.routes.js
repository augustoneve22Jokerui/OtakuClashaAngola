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
 * Todas as rotas de carteira exigem autenticação do usuário.
 */
router.use(authMiddleware);

/**
 * Rotas de Usuário
 */

// Obter saldo da própria carteira
router.get(
  '/balance',
  walletsController.safe(walletsController.getMyBalance)
);

// Solicitar saque de fundos
router.post(
  '/withdraw',
  validationMiddleware({
    body: z.object({
      amount: z.coerce.number().positive('O valor deve ser positivo').min(1000, 'O valor mínimo para saque é 1000 AKZ'),
      bankAccount: z.string().min(10, 'IBAN/Conta inválida'),
      bankName: z.string().min(2, 'Nome do banco é obrigatório')
    })
  }),
  walletsController.safe(walletsController.requestWithdrawal)
);

/**
 * Rotas Administrativas (Apenas ADMIN)
 */
router.use(roleMiddleware(Roles.ADMIN));

// Consultar saldo de um usuário específico
router.get(
  '/admin/user/:userId',
  validationMiddleware({
    params: z.object({ userId: CommonSchema.uuid })
  }),
  walletsController.safe(walletsController.getBalanceByAdmin)
);

// Ajuste manual de saldo (Crédito ou Débito administrativo)
router.post(
  '/admin/adjust',
  validationMiddleware({
    body: z.object({
      userId: CommonSchema.uuid,
      amount: z.coerce.number().positive('O valor deve ser positivo'),
      type: z.enum(['CREDIT', 'DEBIT']),
      description: z.string().min(5, 'Forneça uma justificativa detalhada para o ajuste').max(255)
    })
  }),
  walletsController.safe(walletsController.adjustBalance)
);

module.exports = router;