/**
 * 📝 OTAKU CLASH ANGOLA - TRANSACTIONS CONTROLLER
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Gerencia requisições de histórico financeiro, auditoria e resumos.
 */

const BaseController = require('../../core/base/BaseController');
const transactionsService = require('./transactions.service');

class TransactionsController extends BaseController {
  constructor() {
    super();
  }

  /**
   * 📄 OBTÉM EXTRATO DO UTILIZADOR LOGADO
   * GET /api/v1/transactions/me
   */
  async getMyHistory(req, res) {
    const userId = req.user.id;
    const { page, limit, type, status } = req.query;

    const result = await transactionsService.getUserHistory(userId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      type,
      status
    });

    // Utiliza o método de paginação padronizado da BaseController
    return this.paginate(res, result.items, result.pagination);
  }

  /**
   * 📊 RESUMO FINANCEIRO (CRÉDITOS vs DÉBITOS)
   * GET /api/v1/transactions/me/summary
   */
  async getMySummary(req, res) {
    const userId = req.user.id;
    const summary = await transactionsService.getUserSummary(userId);
    
    return this.success(res, summary, 'Resumo financeiro recuperado com sucesso.');
  }

  /**
   * 🔍 DETALHES DE UMA TRANSAÇÃO ESPECÍFICA
   * GET /api/v1/transactions/:id
   */
  async getDetails(req, res) {
    const userId = req.user.id;
    const { id: transactionId } = req.params;
    
    // Verifica se o utilizador é ADMIN para permitir visualização de qualquer transação
    const isAdmin = req.user.role === 'ADMIN';

    const transaction = await transactionsService.getTransactionDetails(
      userId, 
      transactionId, 
      isAdmin
    );

    return this.success(res, transaction, 'Detalhes da transação recuperados.');
  }

  /**
   * 🛑 CANCELAR TRANSAÇÃO PENDENTE
   * POST /api/v1/transactions/:id/cancel
   */
  async cancel(req, res) {
    const userId = req.user.id; // Para validação de posse no Service
    const { id: transactionId } = req.params;

    // Apenas utilizadores donos da transação ou ADMINS podem cancelar
    const transaction = await transactionsService.getTransactionDetails(userId, transactionId);
    
    const result = await transactionsService.cancelPendingTransaction(
      transactionId, 
      'Cancelado manualmente pelo utilizador/admin'
    );

    return this.success(res, result, 'Transação cancelada com sucesso.');
  }

  /**
   * 🌍 LEDGER FINANCEIRO GLOBAL (ADMIN ONLY)
   * GET /api/v1/transactions/admin/recent
   */
  async getAdminRecent(req, res) {
    const { page, limit, type, status, search } = req.query;
    
    const result = await transactionsService.getAdminRecentHistory({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
      type,
      status,
      search
    });

    return this.paginate(res, result.items, result.pagination);
  }
}

module.exports = new TransactionsController();