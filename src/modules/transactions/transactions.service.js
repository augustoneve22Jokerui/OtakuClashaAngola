const BaseService = require('../../core/base/BaseService');
const transactionsRepository = require('./transactions.repository');
const AppError = require('../../core/errors/AppError');
const logger = require('../../config/logger');

/**
 * TransactionsService - Gerencia a lógica de negócio do extrato financeiro.
 */
class TransactionsService extends BaseService {
  constructor() {
    super(transactionsRepository);
  }

  /**
   * Obtém o histórico de transações de um usuário com paginação e filtros.
   * @param {string} userId - ID do usuário logado.
   * @param {Object} filters - { type, status, page, limit }
   */
  async getUserHistory(userId, filters) {
    try {
      const { type, status, page = 1, limit = 20 } = filters;
      const offset = (page - 1) * limit;

      const items = await this.repository.findByUserId(userId, {
        type,
        status,
        limit,
        offset
      });

      const total = await this.repository.countByUserId(userId, { type, status });

      return {
        items,
        pagination: {
          total,
          page,
          limit
        }
      };
    } catch (error) {
      logger.error(`[TransactionsService] Erro ao buscar histórico do usuário ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtém detalhes de uma transação específica, validando a posse.
   */
  async getTransactionDetails(userId, transactionId) {
    const transaction = await this.repository.findByIdAndUser(transactionId, userId);

    if (!transaction) {
      throw AppError.notFound('Transação não encontrada ou acesso negado.');
    }

    return transaction;
  }

  /**
   * Gera um resumo financeiro (Entradas vs Saídas) para o usuário.
   */
  async getUserSummary(userId) {
    try {
      const summary = await this.repository.getUserFinancialSummary(userId);
      
      const result = {
        total_credit: 0,
        total_debit: 0,
        transactions_count: 0
      };

      summary.forEach(row => {
        if (row.direction === 'CREDIT') {
          result.total_credit = parseFloat(row.total_amount);
        } else {
          result.total_debit = parseFloat(row.total_amount);
        }
        result.transactions_count += parseInt(row.count);
      });

      return result;
    } catch (error) {
      logger.error(`[TransactionsService] Erro ao gerar resumo para usuário ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Retorna as transações globais recentes para auditoria administrativa.
   */
  async getAdminRecentHistory(limit = 50) {
    try {
      return await this.repository.findGlobalRecent(limit);
    } catch (error) {
      logger.error(`[TransactionsService] Erro na consulta administrativa: ${error.message}`);
      throw AppError.internal('Erro ao recuperar histórico global.');
    }
  }

  /**
   * Cancela uma transação pendente (apenas se fizer sentido para o negócio).
   */
  async cancelPendingTransaction(userId, transactionId) {
    const transaction = await this.getTransactionDetails(userId, transactionId);

    if (transaction.status !== 'PENDING') {
      throw AppError.badRequest('Apenas transações pendentes podem ser canceladas.');
    }

    return await this.repository.updateStatus(transactionId, 'CANCELLED', {
      cancelled_at: new Date().toISOString(),
      reason: 'Cancelado pelo usuário'
    });
  }
}

module.exports = new TransactionsService();