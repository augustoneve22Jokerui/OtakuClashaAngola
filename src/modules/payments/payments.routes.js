const express = require('express');
const paymentsController = require('./payments.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const validationMiddleware = require('../../middlewares/validation.middleware');
const CommonSchema = require('../../validators/common.schema');
const { z } = require('zod');

const router = express.Router();

/**
 * Rota Pública: Webhook do Multicaixa Express (MCX)
 * Recebe notificações assíncronas do provedor de pagamento.
 */
router.post(
  '/webhook/mcx',
  // Note: Webhooks geralmente não usam Auth Bearer, a validação é feita via assinatura no payload (dentro do controller/service)
  paymentsController.safe(paymentsController.handleMCXWebhook)
);

/**
 * Rotas Privadas: Requerem autenticação do usuário
 */
router.use(authMiddleware);

/**
 * Solicitar um novo depósito.
 * POST /api/v1/payments/deposit
 */
router.post(
  '/deposit',
  validationMiddleware({
    body: z.object({
      amount: z.coerce.number().min(500, 'O valor mínimo para depósito é 500 AKZ'),
      method: z.enum(['MCX_EXPRESS']),
      phoneNumber: z.string().regex(/^(91|92|93|94|95|99)\d{7}$/, 'Número de telefone inválido (Angola)')
    })
  }),
  paymentsController.safe(paymentsController.requestDeposit)
);

/**
 * Verificar status de uma transação específica.
 * GET /api/v1/payments/status/:transactionId
 */
router.get(
  '/status/:transactionId',
  validationMiddleware({
    params: z.object({ transactionId: CommonSchema.uuid })
  }),
  paymentsController.safe(paymentsController.checkStatus)
);

/**
 * Listar métodos de pagamento disponíveis.
 * GET /api/v1/payments/methods
 */
router.get(
  '/methods',
  paymentsController.safe(paymentsController.getActiveMethods)
);

module.exports = router;