const PaymentGateway = require('./PaymentGateway');
const axios = require('axios');
const logger = require('../../../config/logger');
const AppError = require('../../../core/errors/AppError');
const env = require('../../../config/env');

/**
 * MCXExpress - Implementação do Gateway Multicaixa Express.
 * Adaptado para as normas da EMIS e agregadores locais em Angola.
 */
class MCXExpress extends PaymentGateway {
  constructor() {
    super('MCX_EXPRESS');
    this.terminalId = process.env.MCX_EXPRESS_TERMINAL_ID;
    this.secret = process.env.MCX_EXPRESS_SECRET;
    this.baseUrl = env.NODE_ENV === 'production' 
      ? 'https://api.mcxexpress.ao/v1' 
      : 'https://sandbox.mcxexpress.ao/v1';
  }

  /**
   * Cria uma intenção de pagamento (Referência de Depósito).
   * @param {Object} paymentData - { amount, orderId, phoneNumber }
   */
  async createPreference(paymentData) {
    const { amount, orderId, phoneNumber } = paymentData;

    try {
      logger.info(`[MCXExpress] Iniciando pagamento para Order: ${orderId}, Tel: ${phoneNumber}`);

      // Simulação de chamada para a API do Agregador/EMIS
      // Em ambiente real, aqui seria efetuado um POST com HMAC signature
      const payload = {
        terminalId: this.terminalId,
        amount: parseFloat(amount),
        currency: 'AKZ',
        reference: orderId,
        phoneNumber: phoneNumber,
        callbackUrl: `${env.API_URL}/api/v1/payments/webhook/mcx`
      };

      // Exemplo de integração (comentado para evitar falha de rede externa em ambiente de geração)
      /*
      const response = await axios.post(`${this.baseUrl}/payments`, payload, {
        headers: { 'Authorization': `Bearer ${this.secret}` }
      });
      return response.data;
      */

      // Retorno formatado conforme contrato do gateway
      return {
        provider: this.name,
        transactionId: `MCX-${Date.now()}-${orderId}`,
        reference: orderId,
        status: 'PENDING',
        paymentUrl: null, // MCX Express geralmente dispara push no telefone
        instructions: 'Confirme o pagamento no seu aplicativo Multicaixa Express.'
      };
    } catch (error) {
      logger.error(`[MCXExpress] Erro ao criar preferência: ${error.message}`);
      throw new AppError('Falha ao comunicar com Multicaixa Express.', 502);
    }
  }

  /**
   * Verifica o status atual da transação.
   */
  async verifyTransaction(transactionId) {
    try {
      // Simulação de consulta de status (Polling)
      /*
      const response = await axios.get(`${this.baseUrl}/payments/${transactionId}`, {
        headers: { 'Authorization': `Bearer ${this.secret}` }
      });
      return this.mapStatus(response.data.status);
      */
      
      return 'PENDING';
    } catch (error) {
      logger.error(`[MCXExpress] Erro ao verificar transação ${transactionId}: ${error.message}`);
      return 'FAILED';
    }
  }

  /**
   * Processa o retorno (webhook) da EMIS.
   */
  async handleWebhook(payload) {
    try {
      // 1. Validar assinatura do Webhook para segurança
      // 2. Extrair dados da transação
      const { reference, status, mcxTransactionId } = payload;

      return {
        orderId: reference,
        providerTransactionId: mcxTransactionId,
        status: this.mapStatus(status),
        raw: payload
      };
    } catch (error) {
      logger.error(`[MCXExpress] Erro ao processar webhook: ${error.message}`);
      throw new AppError('Erro na validação do pagamento.', 400);
    }
  }

  /**
   * Converte status do provedor para status interno.
   */
  mapStatus(providerStatus) {
    const statusMap = {
      'APPROVED': 'COMPLETED',
      'SUCCESS': 'COMPLETED',
      'PENDING': 'PENDING',
      'EXPIRED': 'FAILED',
      'REJECTED': 'FAILED',
      'CANCELLED': 'FAILED'
    };

    return statusMap[providerStatus] || 'FAILED';
  }
}

module.exports = new MCXExpress();