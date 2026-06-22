const BaseService = require('../../core/base/BaseService');
const AppError = require('../../core/errors/AppError');
const logger = require('../../config/logger');
const db = require('../../config/database');
const mcxExpress = require('./interfaces/MCXExpress');
const { TransactionStatus } = require('../../core/constants/TransactionTypes');

/**
 * PaymentsService - Orquestrador de transações financeiras externas e integração com gateways.
 */
class PaymentsService extends BaseService {
  constructor() {
    super(null); // Não utiliza um repositório CRUD simples, mas interage com wallets e transactions
    this.gateways = {
      MCX_EXPRESS: mcxExpress
    };
  }

  /**
   * Inicia um processo de depósito na carteira do usuário.
   * @param {string} userId - ID do usuário.
   * @param {Object} data - { amount, method, phoneNumber }
   */
  async requestDeposit(userId, data) {
    const { amount, method, phoneNumber } = data;
    const gateway = this.gateways[method];

    if (!gateway) {
      throw AppError.badRequest('Método de pagamento não suportado.');
    }

    // 1. Busca a wallet do usuário
    const { rows: [wallet] } = await db.query(
      'SELECT id FROM public.wallets WHERE user_id = $1',
      [userId]
    );

    if (!wallet) throw AppError.notFound('Carteira não encontrada.');

    // 2. Cria referência interna de transação (PENDING)
    const { rows: [transaction] } = await db.query(
      `INSERT INTO public.wallet_transactions (wallet_id, amount, direction, type, status, description, metadata)
       VALUES ($1, $2, 'CREDIT', 'DEPOSIT', $3, $4, $5)
       RETURNING id`,
      [
        wallet.id, 
        amount, 
        TransactionStatus.PENDING, 
        `Depósito via ${method}`, 
        JSON.stringify({ method, phoneNumber })
      ]
    );

    // 3. Solicita ao Gateway a criação da preferência de pagamento
    try {
      const paymentResponse = await gateway.createPreference({
        amount,
        orderId: transaction.id,
        phoneNumber
      });

      // 4. Atualiza a transação com a referência do provedor
      await db.query(
        'UPDATE public.wallet_transactions SET reference_id = $1 WHERE id = $2',
        [paymentResponse.transactionId, transaction.id]
      );

      return {
        transactionId: transaction.id,
        ...paymentResponse
      };
    } catch (error) {
      logger.error(`[PaymentsService] Falha ao solicitar pagamento no gateway: ${error.message}`);
      // Marca transação como falha
      await db.query(
        'UPDATE public.wallet_transactions SET status = $1 WHERE id = $2',
        [TransactionStatus.FAILED, transaction.id]
      );
      throw error;
    }
  }

  /**
   * Processa a confirmação de pagamento vinda de um Webhook.
   * @param {string} method - O gateway que enviou o webhook.
   * @param {Object} payload - Dados brutos do provedor.
   */
  async handleProviderWebhook(method, payload) {
    const gateway = this.gateways[method];
    if (!gateway) throw new Error('Gateway inválido no webhook.');

    const result = await gateway.handleWebhook(payload);
    const { orderId, status, providerTransactionId } = result;

    return await this.executeInTransaction(async (client) => {
      // 1. Busca e trava a transação para evitar concorrência
      const { rows: [transaction] } = await client.query(
        'SELECT * FROM public.wallet_transactions WHERE id = $1 FOR UPDATE',
        [orderId]
      );

      if (!transaction) throw new Error(`Transação ${orderId} não encontrada.`);
      
      // Se já estiver finalizada, ignora (evita processamento duplo)
      if (transaction.status !== TransactionStatus.PENDING) {
        return { alreadyProcessed: true };
      }

      // 2. Atualiza status da transação
      await client.query(
        'UPDATE public.wallet_transactions SET status = $1, metadata = metadata || $2 WHERE id = $3',
        [status, JSON.stringify({ providerResponse: result }), orderId]
      );

      // 3. Se aprovado, incrementa o saldo da Wallet
      if (status === TransactionStatus.COMPLETED) {
        await client.query(
          'UPDATE public.wallets SET balance_available = balance_available + $1, updated_at = NOW() WHERE id = $2',
          [transaction.amount, transaction.wallet_id]
        );
        
        logger.info(`[PaymentsService] Depósito confirmado! Wallet: ${transaction.wallet_id}, Valor: ${transaction.amount}`);
      }

      return { success: true, status };
    });
  }

  /**
   * Sincroniza o status de uma transação pendente (Fallback para falhas de Webhook).
   */
  async syncTransactionStatus(transactionId) {
    const { rows: [transaction] } = await db.query(
      'SELECT t.*, w.user_id FROM public.wallet_transactions t JOIN public.wallets w ON t.wallet_id = w.id WHERE t.id = $1',
      [transactionId]
    );

    if (!transaction || transaction.status !== TransactionStatus.PENDING) return;

    // Obtém o método a partir do metadata
    const metadata = typeof transaction.metadata === 'string' ? JSON.parse(transaction.metadata) : transaction.metadata;
    const gateway = this.gateways[metadata.method];

    if (gateway) {
      const currentStatus = await gateway.verifyTransaction(transaction.reference_id || transaction.id);
      if (currentStatus !== TransactionStatus.PENDING) {
        // Se mudou, processamos como se fosse um webhook
        await this.handleProviderWebhook(metadata.method, { 
          reference: transaction.id, 
          status: currentStatus,
          mcxTransactionId: transaction.reference_id 
        });
      }
    }
  }
}

module.exports = new PaymentsService();