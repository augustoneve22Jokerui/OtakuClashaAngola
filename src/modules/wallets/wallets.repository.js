/**
 * 💳 OTAKU CLASH ANGOLA - WALLETS REPOSITORY
 * Versão: 2.0.0 - Enterprise Grade (Atomic)
 * Descrição: Camada de persistência para ativos financeiros com proteção contra concorrência.
 */

const BaseRepository = require('../../core/base/BaseRepository');
const logger = require('../../config/logger');

class WalletsRepository extends BaseRepository {
  constructor() {
    super('public.wallets');
  }

  /**
   * 🔍 BUSCA CARTEIRA POR UTILIZADOR COM TRAVA DE ATUALIZAÇÃO
   * Utiliza FOR UPDATE para impedir que outros processos alterem o saldo simultaneamente.
   */
  async findByUserId(userId, client = null) {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE user_id = $1 
      LIMIT 1 
      FOR UPDATE
    `;
    
    try {
      const executor = client || this.db;
      const { rows } = await executor.query(query, [userId]);
      return rows[0] || null;
    } catch (error) {
      logger.error(`[WalletsRepo:findByUserId] Erro: ${error.message}`);
      return null;
    }
  }

  /**
   * ⚡ ATUALIZAÇÃO ATÔMICA DE SALDO DISPONÍVEL
   * Realiza o crédito ou débito garantindo que o saldo final seja >= 0.
   */
  async updateBalance(walletId, amount, client = null) {
    const query = `
      UPDATE ${this.tableName}
      SET 
        balance_available = balance_available + $1,
        updated_at = NOW()
      WHERE id = $2 
      AND (balance_available + $1) >= 0
      RETURNING *
    `;

    try {
      const executor = client || this.db;
      const { rows } = await executor.query(query, [amount, walletId]);
      
      if (rows.length === 0) {
        throw new Error('Operação negada: Saldo insuficiente ou carteira inexistente.');
      }
      
      return rows[0];
    } catch (error) {
      logger.error(`[WalletsRepo:updateBalance] Falha: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🔒 BLOQUEIO DE FUNDOS (RESERVA PARA PARTIDA)
   * Move o valor do saldo disponível para o saldo bloqueado de forma atômica.
   */
  async lockFunds(walletId, amount, client = null) {
    const query = `
      UPDATE ${this.tableName}
      SET 
        balance_available = balance_available - $1,
        balance_locked = balance_locked + $1,
        updated_at = NOW()
      WHERE id = $2 
      AND balance_available >= $1
      RETURNING *
    `;

    try {
      const executor = client || this.db;
      const { rows } = await executor.query(query, [amount, walletId]);
      return rows[0] || null;
    } catch (error) {
      logger.error(`[WalletsRepo:lockFunds] Falha na reserva: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🔓 LIBERAÇÃO DE FUNDOS BLOQUEADOS (ESTORNO)
   * Retorna o valor bloqueado para o saldo disponível.
   */
  async releaseFunds(walletId, amount, client = null) {
    const query = `
      UPDATE ${this.tableName}
      SET 
        balance_locked = balance_locked - $1,
        balance_available = balance_available + $1,
        updated_at = NOW()
      WHERE id = $2 
      AND balance_locked >= $1
      RETURNING *
    `;

    try {
      const executor = client || this.db;
      const { rows } = await executor.query(query, [amount, walletId]);
      return rows[0] || null;
    } catch (error) {
      logger.error(`[WalletsRepo:releaseFunds] Erro: ${error.message}`);
      throw error;
    }
  }

  /**
   * 💸 CONSUMO DE FUNDOS BLOQUEADOS (CONFIRMAÇÃO DE GASTO)
   * Deduz o valor definitivamente do saldo bloqueado.
   */
  async spendLockedFunds(walletId, amount, client = null) {
    const query = `
      UPDATE ${this.tableName}
      SET 
        balance_locked = balance_locked - $1,
        updated_at = NOW()
      WHERE id = $2 
      AND balance_locked >= $1
      RETURNING *
    `;

    try {
      const executor = client || this.db;
      const { rows } = await executor.query(query, [amount, walletId]);
      return rows[0] || null;
    } catch (error) {
      logger.error(`[WalletsRepo:spendLockedFunds] Erro: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🔍 VERIFICAÇÃO RÁPIDA DE SALDO
   */
  async hasAvailableBalance(userId, amount) {
    const query = `
      SELECT (balance_available >= $1) as "hasFunds" 
      FROM ${this.tableName} 
      WHERE user_id = $2
    `;
    try {
      const { rows } = await this.db.query(query, [amount, userId]);
      return rows.length > 0 && rows[0].hasFunds;
    } catch (error) {
      return false;
    }
  }

  /**
   * 📊 MÉTRICAS TÉCNICAS (ADMIN)
   */
  async getGlobalFinancialHealth() {
    const query = `
      SELECT 
        SUM(balance_available) as "totalAvailable",
        SUM(balance_locked) as "totalLocked",
        COUNT(*) as "totalWallets",
        AVG(balance_available) as "averageBalance"
      FROM ${this.tableName}
    `;
    try {
      const { rows } = await this.db.query(query);
      return rows[0];
    } catch (error) {
      return { totalAvailable: 0, totalLocked: 0, totalWallets: 0 };
    }
  }
}

module.exports = new WalletsRepository();