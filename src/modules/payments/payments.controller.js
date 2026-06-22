const BaseController = require('../../core/base/BaseController');
const paymentsService = require('./payments.service');
const logger = require('../../config/logger');

/**
 * PaymentsController - Controlador para gestão de pagamentos externos e webhooks.
 */
class PaymentsController extends BaseController {
  constructor() {
    super();
  }

  /**
   * Solicita um novo depósito na carteira via Gateway externo.
   * POST /api/v1/payments/deposit
   */
  async requestDeposit(req, res) {
    const userId = req.user.id;
    const { amount, method, phoneNumber } = req.body;

    const result = await paymentsService.requestDeposit(userId, {
      amount: parseFloat(amount),
      method,
      phoneNumber
    });

    return this.success(res, result, 'Solicitação de depósito iniciada. Aguarde a confirmação no seu dispositivo.');
  }

  /**
   * Recebe e processa Webhooks do Multicaixa Express (MCX).
   * POST /api/v1/payments/webhook/mcx
   */
  async handleMCXWebhook(req, res) {
    const payload = req.body;
    
    logger.info('[PaymentsController] Webhook MCX recebido:', { payload });

    try {
      // Processa o webhook de forma assíncrona
      const result = await paymentsService.handleProviderWebhook('MCX_EXPRESS', payload);
      
      // Gateways esperam resposta 200 para confirmar recebimento do webhook
      return res.status(200).json({ status: 'received', ...result });
    } catch (error) {
      logger.error(`[PaymentsController] Erro ao processar webhook MCX: ${error.message}`);
      // Mesmo com erro interno, retornamos 200/202 para evitar retentativas infinitas do provedor 
      // se o erro for de lógica, ou 400 se for erro de validação.
      return res.status(400).json({ status: 'error', message: error.message });
    }
  }

  /**
   * Sincroniza manualmente o status de uma transação específica.
   * GET /api/v1/payments/status/:transactionId
   */
  async checkStatus(req, res) {
    const { transactionId } = req.params;
    
    await paymentsService.syncTransactionStatus(transactionId);
    
    // Busca a transação atualizada no banco
    const { rows } = await require('../../config/database').query(
      'SELECT status, amount, reference_id FROM public.wallet_transactions WHERE id = $1',
      [transactionId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Transação não encontrada.' });
    }

    return this.success(res, rows[0], 'Status da transação verificado.');
  }

  /**
   * Lista os métodos de pagamento ativos no sistema.
   * GET /api/v1/payments/methods
   */
  async getActiveMethods(req, res) {
    const methods = [
      {
        id: 'MCX_EXPRESS',
        name: 'Multicaixa Express',
        currency: 'AKZ',
        minAmount: 500,
        maxAmount: 1000000,
        status: 'ACTIVE'
      }
      // Outros métodos como Unitel Money podem ser adicionados aqui
    ];

    return this.success(res, methods);
  }
}

module.exports = new PaymentsController();