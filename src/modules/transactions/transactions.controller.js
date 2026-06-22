const BaseController = require('../../core/base/BaseController');
const transactionsService = require('./transactions.service');

/**
 * TransactionsController - Controlador para gestão de histórico financeiro.
 */
class TransactionsController extends BaseController {
  constructor() {
    super();
  }

  /**
   * Obtém o extrato de transações do usuário logado.
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

    return this.paginate(res, result.items, result.pagination);
  }

  /**
   * Obtém um resumo financeiro simplificado (Créditos vs Débitos).
   * GET /api/v1/transactions/me/summary
   */
  async getMySummary(req, res) {
    const userId = req.user.id;
    const summary = await transactionsService.getUserSummary(userId);
    
    return this.success(res, summary, 'Resumo financeiro recuperado.');
  }

  /**
   * Obtém os detalhes de uma transação específica.
   * GET /api/v1/transactions/:id
   */
  async getDetails(req, res) {
    const userId = req.user.id;
    const { id: transactionId } = req.params;

    const transaction = await transactionsService.getTransactionDetails(userId, transactionId);

    return this.success(res, transaction, 'Detalhes da transação recuperados.');
  }

  /**
   * Cancela uma transação pendente.
   * POST /api/v1/transactions/:id/cancel
   */
  async cancel(req, res) {
    const userId = req.user.id;
    const { id: transactionId } = req.params;

    const result = await transactionsService.cancelPendingTransaction(userId, transactionId);

    return this.success(res, result, 'Transação cancelada com sucesso.');
  }

  /**
   * Lista as transações globais recentes (Apenas ADMIN).
   * GET /api/v1/transactions/admin/recent
   */
  async getAdminRecent(req, res) {
    const { limit } = req.query;
    
    const history = await transactionsService.getAdminRecentHistory(parseInt(limit) || 50);

    return this.success(res, history, 'Histórico global de transações recuperado.');
  }
}

module.exports = new TransactionsController();