/**
 * 💳 OTAKU CLASH ANGOLA - WALLETS CONTROLLER
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Gerencia requisições de consulta de saldo, ajustes e retiradas.
 */

const BaseController = require('../../core/base/BaseController');
const walletsService = require('./wallets.service');
const WalletsDTO = require('./wallets.dto');

class WalletsController extends BaseController {
  constructor() {
    super();
  }

  /**
   * 💰 OBTÉM SALDO DO UTILIZADOR AUTENTICADO
   * GET /api/v1/wallets/balance
   */
  async getMyBalance(req, res) {
    const userId = req.user.id;
    
    const wallet = await walletsService.getBalance(userId);
    const transformed = WalletsDTO.transform(wallet);

    return this.success(res, transformed, 'Saldo da carteira recuperado.');
  }

  /**
   * 🔍 CONSULTA ADMINISTRATIVA DE SALDO
   * GET /api/v1/wallets/admin/user/:userId
   */
  async getBalanceByAdmin(req, res) {
    const { userId } = req.params;

    const wallet = await walletsService.getBalance(userId);
    const transformed = WalletsDTO.transform(wallet);

    return this.success(res, transformed, 'Dados financeiros do utilizador recuperados.');
  }

  /**
   * 🛠️ AJUSTE MANUAL DE SALDO (ADMIN)
   * Permite que administradores realizem créditos ou débitos diretos.
   * POST /api/v1/wallets/admin/adjust
   */
  async adjustBalance(req, res) {
    const { userId, amount, type, description } = req.body;
    const adminId = req.user.id;

    let result;

    // A lógica de negócio no Service garante a atomicidade
    if (type === 'CREDIT') {
      result = await walletsService.credit(
        userId, 
        parseFloat(amount), 
        'ADMIN_CREDIT', 
        description || 'Ajuste administrativo de crédito',
        { adminId }
      );
    } else if (type === 'DEBIT') {
      result = await walletsService.debit(
        userId, 
        parseFloat(amount), 
        'ADMIN_DEBIT', 
        description || 'Ajuste administrativo de débito',
        { adminId }
      );
    } else {
      const AppError = require('../../core/errors/AppError');
      throw AppError.badRequest('Tipo de ajuste inválido. Use CREDIT ou DEBIT.');
    }

    return this.success(res, WalletsDTO.transform(result), 'Ajuste de saldo realizado e auditado.');
  }

  /**
   * 💸 SOLICITAÇÃO DE LEVANTAMENTO (WITHDRAWAL)
   * POST /api/v1/wallets/withdraw
   */
  async requestWithdrawal(req, res) {
    const userId = req.user.id;
    const { amount, bankAccount, bankName } = req.body;

    // Realiza o débito imediato e coloca o valor em reserva (ou transação pendente)
    // No ecossistema real, o valor é deduzido do disponível e registrado para aprovação humana.
    const result = await walletsService.debit(
      userId, 
      parseFloat(amount), 
      'WITHDRAWAL', 
      `Solicitação de saque: ${bankName} / ${bankAccount}`,
      { bankAccount, bankName, status: 'PENDING' }
    );

    return this.success(
      res, 
      WalletsDTO.transform(result), 
      'Sua solicitação de levantamento foi registada e está em processamento.'
    );
  }

  /**
   * 📋 LISTA TRANSAÇÕES RECENTES (DASHBOARD)
   * GET /api/v1/wallets/admin/transactions
   */
  async getAdminRecentTransactions(req, res) {
    const { limit = 50, page = 1 } = req.query;
    
    const transactionsService = require('../transactions/transactions.service');
    const history = await transactionsService.getAdminRecentHistory(parseInt(limit));
    
    return this.success(res, history, 'Histórico global de transações recuperado.');
  }
}

module.exports = new WalletsController();