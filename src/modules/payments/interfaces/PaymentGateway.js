const AppError = require('../../../core/errors/AppError');

/**
 * PaymentGateway - Interface Abstrata para provedores de pagamento.
 * Define o contrato obrigatório para qualquer integração (MCX Express, Stripe, etc).
 */
class PaymentGateway {
  constructor(name) {
    this.name = name;
  }

  /**
   * Inicia um processo de pagamento e gera o link/referência.
   * @param {Object} paymentData - { amount, orderId, customerData }
   * @throws {Error} Se não implementado pela subclasse.
   */
  async createPreference(paymentData) {
    throw new Error(`Método createPreference() não implementado em ${this.name}`);
  }

  /**
   * Verifica o status de uma transação junto ao provedor.
   * @param {string} transactionId 
   * @throws {Error} Se não implementado pela subclasse.
   */
  async verifyTransaction(transactionId) {
    throw new Error(`Método verifyTransaction() não implementado em ${this.name}`);
  }

  /**
   * Processa o Webhook enviado pelo provedor de pagamento.
   * @param {Object} payload - Dados brutos recebidos na requisição HTTP.
   * @throws {Error} Se não implementado pela subclasse.
   */
  async handleWebhook(payload) {
    throw new Error(`Método handleWebhook() não implementado em ${this.name}`);
  }

  /**
   * Solicita o estorno (refund) de uma transação.
   * @param {string} transactionId 
   * @param {number} amount 
   */
  async refund(transactionId, amount) {
    throw new Error(`Método refund() não implementado em ${this.name}`);
  }

  /**
   * Padroniza o status do provedor para os estados internos do sistema.
   * @param {string} providerStatus 
   * @returns {string} internalStatus (PENDING, COMPLETED, FAILED)
   */
  mapStatus(providerStatus) {
    throw new Error(`Método mapStatus() não implementado em ${this.name}`);
  }
}

module.exports = PaymentGateway;