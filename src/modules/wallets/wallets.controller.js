const BaseController = require('../../core/base/BaseController');
const walletsService = require('./wallets.service');
const WalletsDTO = require('./wallets.dto');

/**
 * WalletsController - Gerencia as operações de consulta e movimentação financeira da carteira.
 */
class WalletsController extends BaseController {
  constructor() {
    super();
  }

  /**
   * Obtém o saldo detalhado da carteira do usuário logado.
   * GET /api/v1/wallets/balance
   */
  async getMyBalance(req, res) {
    const userId = req.user.id;
    
    const wallet = await walletsService.getBalance(userId);
    const transformed = WalletsDTO.transform(wallet);

    return this.success(res, transformed, 'Saldo da carteira recuperado com sucesso.');
  }

  /**
   * Obtém os dados da carteira de um usuário específico (Apenas ADMIN).
   * GET /api/v1/wallets/admin/user/:userId
   */
  async getBalanceByAdmin(req, res) {
    const { userId } = req.params;

    const wallet = await walletsService.getBalance(userId);
    const transformed = WalletsDTO.transform(wallet);

    return this.success(res, transformed, 'Dados financeiros do usuário recuperados pelo administrador.');
  }

  /**
   * Ajuste manual de saldo realizado por administradores (Crédito ou Débito).
   * POST /api/v1/wallets/admin/adjust
   */
  async adjustBalance(req, res) {
    const { userId, amount, type, description } = req.body;
    const adminId = req.user.id;

    let result;

    if (type === 'CREDIT') {
      result = await walletsService.credit(
        userId, 
        parseFloat(amount), 
        'ADMIN_CREDIT', 
        description || 'Ajuste manual de crédito via Admin',
        { adminId }
      );
    } else if (type === 'DEBIT') {
      result = await walletsService.debit(
        userId, 
        parseFloat(amount), 
        'ADMIN_DEBIT', 
        description || 'Ajuste manual de débito via Admin'
      );
    } else {
      return res.status(400).json({ status: 'error', message: 'Tipo de ajuste inválido. Use CREDIT ou DEBIT.' });
    }

    return this.success(res, WalletsDTO.transform(result), 'Ajuste de saldo realizado com sucesso.');
  }

  /**
   * Solicitação de saque (Funcionalidade Futura - Contrato definido).
   * POST /api/v1/wallets/withdraw
   */
  async requestWithdrawal(req, res) {
    const userId = req.user.id;
    const { amount, bankAccount, bankName } = req.body;

    // Lógica preliminar: Debita o valor e move para transação pendente de aprovação
    const result = await walletsService.debit(
      userId, 
      parseFloat(amount), 
      'WITHDRAWAL', 
      `Solicitação de saque para banco ${bankName}`
    );

    return this.success(
      res, 
      WalletsDTO.transform(result), 
      'Sua solicitação de saque foi enviada e está em processamento.'
    );
  }
}

module.exports = new WalletsController();