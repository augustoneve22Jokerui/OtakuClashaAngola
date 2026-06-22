const BaseService = require('../../core/base/BaseService');
const walletsRepository = require('./wallets.repository');
const transactionsRepository = require('../transactions/transactions.repository');
const AppError = require('../../core/errors/AppError');
const { TransactionTypes, TransactionStatus } = require('../../core/constants/TransactionTypes');
const logger = require('../../config/logger');

/**
 * WalletsService - Gerencia as operações financeiras e a integridade do saldo.
 */
class WalletsService extends BaseService {
  constructor() {
    super(walletsRepository);
  }

  /**
   * Obtém o saldo atual do usuário.
   * @param {string} userId 
   */
  async getBalance(userId) {
    const wallet = await this.repository.findByUserId(userId);
    if (!wallet) {
      throw AppError.notFound('Carteira não encontrada para este usuário.');
    }
    return wallet;
  }

  /**
   * Realiza um crédito (depósito/recompensa) na carteira.
   * @param {string} userId 
   * @param {number} amount 
   * @param {string} type - Tipo da transação (ex: DEPOSIT, MATCH_REWARD)
   * @param {string} description 
   * @param {Object} metadata 
   */
  async credit(userId, amount, type, description, metadata = {}) {
    if (amount <= 0) throw AppError.badRequest('O valor do crédito deve ser maior que zero.');

    return await this.executeInTransaction(async (client) => {
      const wallet = await this.getBalance(userId);

      // 1. Atualiza o saldo
      const updatedWallet = await this.repository.updateBalance(wallet.id, amount, client);

      // 2. Registra a transação
      await transactionsRepository.create({
        wallet_id: wallet.id,
        amount,
        direction: 'CREDIT',
        type,
        status: TransactionStatus.COMPLETED,
        description,
        metadata: JSON.stringify(metadata)
      }, client);

      logger.info(`[WalletsService] Crédito de ${amount} AKZ processado para usuário ${userId}. Tipo: ${type}`);
      return updatedWallet;
    });
  }

  /**
   * Realiza um débito (saque/compra/taxa) na carteira.
   * @param {string} userId 
   * @param {number} amount 
   * @param {string} type 
   * @param {string} description 
   */
  async debit(userId, amount, type, description) {
    if (amount <= 0) throw AppError.badRequest('O valor do débito deve ser maior que zero.');

    return await this.executeInTransaction(async (client) => {
      const wallet = await this.getBalance(userId);

      // Verifica saldo suficiente
      if (parseFloat(wallet.balance_available) < amount) {
        throw AppError.badRequest('Saldo insuficiente para realizar esta operação.');
      }

      // 1. Atualiza o saldo (passando valor negativo para o repository)
      const updatedWallet = await this.repository.updateBalance(wallet.id, -amount, client);

      // 2. Registra a transação
      await transactionsRepository.create({
        wallet_id: wallet.id,
        amount,
        direction: 'DEBIT',
        type,
        status: TransactionStatus.COMPLETED,
        description
      }, client);

      logger.info(`[WalletsService] Débito de ${amount} AKZ processado para usuário ${userId}. Tipo: ${type}`);
      return updatedWallet;
    });
  }

  /**
   * Reserva fundos para entrada em uma partida (Move para saldo bloqueado).
   * @param {string} userId 
   * @param {number} amount 
   * @param {string} matchId 
   */
  async reserveForMatch(userId, amount, matchId) {
    return await this.executeInTransaction(async (client) => {
      const wallet = await this.getBalance(userId);

      const updatedWallet = await this.repository.lockFunds(wallet.id, amount, client);

      if (!updatedWallet) {
        throw AppError.badRequest('Saldo insuficiente para entrar na partida.');
      }

      // Registra a transação como PENDING (bloqueada)
      await transactionsRepository.create({
        wallet_id: wallet.id,
        amount,
        direction: 'DEBIT',
        type: TransactionTypes.MATCH_ENTRY,
        status: TransactionStatus.PENDING,
        description: `Reserva para partida ID: ${matchId}`,
        reference_id: matchId
      }, client);

      return updatedWallet;
    });
  }

  /**
   * Confirma o gasto de fundos previamente reservados.
   */
  async confirmMatchExpense(userId, amount, matchId) {
    return await this.executeInTransaction(async (client) => {
      const wallet = await this.getBalance(userId);
      
      const updatedWallet = await this.repository.spendLockedFunds(wallet.id, amount, client);

      // Atualiza o status da transação de PENDING para COMPLETED
      const query = `
        UPDATE public.wallet_transactions 
        SET status = $1, updated_at = NOW()
        WHERE wallet_id = $2 AND reference_id = $3 AND type = $4
      `;
      await client.query(query, [
        TransactionStatus.COMPLETED, 
        wallet.id, 
        matchId, 
        TransactionTypes.MATCH_ENTRY
      ]);

      return updatedWallet;
    });
  }

  /**
   * Estorna fundos reservados (ex: partida cancelada).
   */
  async refundReservedMatch(userId, amount, matchId) {
    return await this.executeInTransaction(async (client) => {
      const wallet = await this.getBalance(userId);
      
      const updatedWallet = await this.repository.releaseFunds(wallet.id, amount, client);

      // Marca a transação de reserva como CANCELLED e cria um registro de REFUND
      await client.query(
        'UPDATE public.wallet_transactions SET status = $1 WHERE wallet_id = $2 AND reference_id = $3',
        [TransactionStatus.CANCELLED, wallet.id, matchId]
      );

      await transactionsRepository.create({
        wallet_id: wallet.id,
        amount,
        direction: 'CREDIT',
        type: TransactionTypes.REFUND,
        status: TransactionStatus.COMPLETED,
        description: `Estorno de reserva: Partida ${matchId}`
      }, client);

      return updatedWallet;
    });
  }
}

module.exports = new WalletsService();