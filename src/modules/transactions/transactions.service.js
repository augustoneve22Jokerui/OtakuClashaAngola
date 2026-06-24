/**
 * 📝 OTAKU CLASH ANGOLA - TRANSACTIONS SERVICE
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Gerencia a lógica de histórico financeiro, auditoria e resumos de caixa.
 */

const BaseService = require('../../core/base/BaseService');
const transactionsRepository = require('./transactions.repository');
const AppError = require('../../core/errors/AppError');
const logger = require('../../config/logger');

class TransactionsService extends BaseService {
  constructor() {
    super(transactionsRepository);
  }

  /**
   * 📄 OBTÉM EXTRATO DO UTILIZADOR (PLAYER VIEW)
   */
  async getUserHistory(userId, filters) {
    try {
      const { page = 1, limit = 20, type, status } = filters;
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
          page: parseInt(page),
          limit: parseInt(limit)
        }
      };
    } catch (error) {
      logger.error(`[TransactionsService:UserHistory] Erro: ${error.message}`);
      throw error;
    }
  }

  /**
   * 📊 GERA RESUMO FINANCEIRO (CREDIT vs DEBIT)
   * Utilizado para widgets de saldo e performance financeira.
   */
  async getUserSummary(userId) {
    try {
      const summaryRows = await this.repository.getUserFinancialSummary(userId);
      
      const result = {
        total_credits: 0,
        total_debits: 0,
        transaction_count: 0
      };

      summaryRows.forEach(row => {
        if (row.direction === 'CREDIT') {
          result.total_credits = parseFloat(row.totalAmount);
        } else if (row.direction === 'DEBIT') {
          result.total_debits = parseFloat(row.totalAmount);
        }
        result.transaction_count += parseInt(row.count);
      });

      return result;
    } catch (error) {
      logger.error(`[TransactionsService:Summary] Erro para ${userId}: ${error.message}`);
      return { total_credits: 0, total_debits: 0, transaction_count: 0 };
    }
  }

  /**
   * 🌍 LEDGER GLOBAL (ADMIN VIEW)
   * Busca todas as movimentações do sistema com dados de utilizador.
   */
  async getAdminRecentHistory(filters) {
    try {
      const { page = 1, limit = 50, type, status, search } = filters;
      const offset = (page - 1) * limit;

      const items = await this.repository.findGlobalRecent({
        type,
        status,
        limit,
        offset,
        search
      });

      const total = await this.repository.countGlobal({ type, status, search });

      return {
        items,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit)
        }
      };
    } catch (error) {
      logger.error(`[TransactionsService:AdminHistory] Erro: ${error.message}`);
      throw new AppError('Falha ao recuperar histórico global para auditoria.', 500);
    }
  }

  /**
   * 🔍 BUSCA DETALHES DE UMA TRANSAÇÃO
   */
  async getTransactionDetails(userId, transactionId, isAdmin = false) {
    let transaction;

    if (isAdmin) {
      transaction = await this.repository.findById(transactionId);
    } else {
      transaction = await this.repository.findByIdAndUser(transactionId, userId);
    }

    if (!transaction) {
      throw AppError.notFound('Transação não localizada ou acesso não autorizado.');
    }

    return transaction;
  }

  /**
   * 🛑 CANCELA TRANSAÇÃO PENDENTE (ADMIN/SISTEMA)
   * Utilizado para depósitos expirados ou ordens de saque rejeitadas.
   */
  async cancelPendingTransaction(transactionId, reason = 'Cancelado pelo sistema') {
    const transaction = await this.repository.findById(transactionId);

    if (!transaction) throw AppError.notFound('Transação inexistente.');
    
    if (transaction.status !== 'PENDING') {
      throw AppError.badRequest(`Não é possível cancelar uma transação com status: ${transaction.status}`);
    }

    try {
      const updated = await this.repository.update(transactionId, {
        status: 'CANCELLED',
        metadata: {
          ...transaction.metadata,
          cancel_reason: reason,
          cancelled_at: new Date().toISOString()
        }
      });

      logger.warn(`[Finance:Cancel] Transação ${transactionId} cancelada. Motivo: ${reason}`);
      return updated;
    } catch (error) {
      logger.error(`[TransactionsService:Cancel] Falha: ${error.message}`);
      throw AppError.internal('Erro ao processar cancelamento da transação.');
    }
  }
}

module.exports = new TransactionsService();