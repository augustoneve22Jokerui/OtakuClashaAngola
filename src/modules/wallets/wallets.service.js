/**
 * 💳 OTAKU CLASH ANGOLA - WALLETS SERVICE
 * Versão: 2.0.0 - Enterprise Grade (Transactional)
 * Descrição: Gestão central de lógica financeira, créditos, débitos e reservas.
 */

const BaseService = require('../../core/base/BaseService');
const walletsRepository = require('./wallets.repository');
const transactionsRepository = require('../transactions/transactions.repository');
const AppError = require('../../core/errors/AppError');
const { TransactionTypes, TransactionStatus } = require('../../core/constants/TransactionTypes');
const logger = require('../../config/logger');

class WalletsService extends BaseService {
  constructor() {
    super(walletsRepository);
  }

  /**
   * 🔍 OBTÉM SALDO ATUAL
   * @param {string} userId - UUID do utilizador.
   */
  async getBalance(userId) {
    const wallet = await this.repository.findByUserId(userId);
    if (!wallet) {
      throw AppError.notFound('Carteira digital não localizada para este utilizador.');
    }
    return wallet;
  }

  /**
   * 💰 REALIZA CRÉDITO (ENTRADA DE DINHEIRO)
   * Fluxo: Depósitos, prêmios de partida, bônus e estornos.
   */
  async credit(userId, amount, type, description, metadata = {}) {
    if (amount <= 0) throw AppError.badRequest('O montante de crédito deve ser positivo.');

    return await this.executeInTransaction(async (client) => {
      // 1. Busca e trava a carteira
      const wallet = await this.repository.findByUserId(userId, client);
      if (!wallet) throw AppError.notFound('Carteira destino não encontrada.');

      // 2. Incrementa o saldo disponível
      const updatedWallet = await this.repository.updateBalance(wallet.id, amount, client);

      // 3. Registra a transação no extrato (Ledger)
      await transactionsRepository.create({
        wallet_id: wallet.id,
        amount: amount,
        direction: 'CREDIT',
        type: type,
        status: TransactionStatus.COMPLETED,
        description: description,
        metadata: JSON.stringify(metadata),
        reference_id: metadata.referenceId || null
      }, client);

      logger.info(`[Finance:Credit] +${amount} AKZ para ${userId} | Motivo: ${type}`);
      return updatedWallet;
    });
  }

  /**
   * 💸 REALIZA DÉBITO (SAÍDA DE DINHEIRO)
   * Fluxo: Compras na loja, taxas administrativas e retiradas.
   */
  async debit(userId, amount, type, description, metadata = {}) {
    if (amount <= 0) throw AppError.badRequest('O montante de débito deve ser positivo.');

    return await this.executeInTransaction(async (client) => {
      const wallet = await this.repository.findByUserId(userId, client);
      if (!wallet) throw AppError.notFound('Carteira origem não encontrada.');

      // 1. Tenta atualizar o saldo (O repositório valida saldo >= 0)
      try {
        const updatedWallet = await this.repository.updateBalance(wallet.id, -amount, client);

        // 2. Registra a transação no extrato
        await transactionsRepository.create({
          wallet_id: wallet.id,
          amount: amount,
          direction: 'DEBIT',
          type: type,
          status: TransactionStatus.COMPLETED,
          description: description,
          metadata: JSON.stringify(metadata)
        }, client);

        logger.info(`[Finance:Debit] -${amount} AKZ de ${userId} | Motivo: ${type}`);
        return updatedWallet;

      } catch (error) {
        logger.warn(`[Finance:Debit] Falha no débito para ${userId}: ${error.message}`);
        throw AppError.badRequest('Saldo insuficiente para realizar esta transação.');
      }
    });
  }

  /**
   * 🔒 RESERVA PARA PARTIDA (DISPUTA)
   * Bloqueia o valor da aposta movendo para 'balance_locked'.
   */
  async reserveForMatch(userId, amount, matchId) {
    return await this.executeInTransaction(async (client) => {
      const wallet = await this.repository.findByUserId(userId, client);
      if (!wallet) throw AppError.notFound('Carteira não encontrada.');

      // 1. Move de Disponível para Bloqueado
      const updatedWallet = await this.repository.lockFunds(wallet.id, amount, client);

      if (!updatedWallet) {
        throw AppError.badRequest('Saldo insuficiente para entrar nesta partida apostada.');
      }

      // 2. Registra transação como PENDENTE (Representa o bloqueio)
      await transactionsRepository.create({
        wallet_id: wallet.id,
        amount: amount,
        direction: 'DEBIT',
        type: TransactionTypes.MATCH_ENTRY,
        status: TransactionStatus.PENDING,
        description: `Entrada em duelo: ${matchId}`,
        reference_id: matchId
      }, client);

      return updatedWallet;
    });
  }

  /**
   * ✅ CONFIRMA GASTO RESERVADO
   * Executado ao fim de uma partida para o perdedor ou para processar a prize pool.
   */
  async confirmMatchExpense(userId, amount, matchId) {
    return await this.executeInTransaction(async (client) => {
      const wallet = await this.repository.findByUserId(userId, client);
      
      // 1. Remove definitivamente do saldo bloqueado
      const updatedWallet = await this.repository.spendLockedFunds(wallet.id, amount, client);

      // 2. Atualiza o status da transação de PENDING para COMPLETED
      const updateTxQuery = `
        UPDATE public.wallet_transactions 
        SET status = $1, updated_at = NOW()
        WHERE wallet_id = $2 AND reference_id = $3 AND type = $4 AND status = 'PENDING'
      `;
      
      await client.query(updateTxQuery, [
        TransactionStatus.COMPLETED, 
        wallet.id, 
        matchId, 
        TransactionTypes.MATCH_ENTRY
      ]);

      return updatedWallet;
    });
  }

  /**
   * 🔄 ESTORNA RESERVA DE PARTIDA
   * Executado quando uma partida é cancelada ou há empate.
   */
  async refundReservedMatch(userId, amount, matchId) {
    return await this.executeInTransaction(async (client) => {
      const wallet = await this.repository.findByUserId(userId, client);
      
      // 1. Retorna de Bloqueado para Disponível
      const updatedWallet = await this.repository.releaseFunds(wallet.id, amount, client);

      // 2. Marca a transação original como CANCELADA
      const cancelTxQuery = `
        UPDATE public.wallet_transactions 
        SET status = $1, updated_at = NOW()
        WHERE wallet_id = $2 AND reference_id = $3 AND status = 'PENDING'
      `;
      await client.query(cancelTxQuery, [TransactionStatus.CANCELLED, wallet.id, matchId]);

      // 3. Cria um registro de estorno (Audit trail)
      await transactionsRepository.create({
        wallet_id: wallet.id,
        amount: amount,
        direction: 'CREDIT',
        type: TransactionTypes.REFUND,
        status: TransactionStatus.COMPLETED,
        description: `Estorno de entrada: Partida ${matchId}`,
        reference_id: matchId
      }, client);

      return updatedWallet;
    });
  }
}

module.exports = new WalletsService();