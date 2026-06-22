const BaseRepository = require('../../core/base/BaseRepository');

/**
 * WalletsRepository - Camada de acesso a dados para o sistema de carteiras (Wallets).
 * Gerencia saldos disponíveis, bloqueados e moedas.
 */
class WalletsRepository extends BaseRepository {
  constructor() {
    super('public.wallets');
  }

  /**
   * Busca a carteira de um usuário específico.
   * @param {string} userId - UUID do usuário.
   */
  async findByUserId(userId) {
    const query = `SELECT * FROM ${this.tableName} WHERE user_id = $1 LIMIT 1`;
    const { rows } = await this.db.query(query, [userId]);
    return rows[0] || null;
  }

  /**
   * Atualiza o saldo disponível de forma atômica.
   * @param {string} walletId 
   * @param {number} amount - Valor positivo para crédito, negativo para débito.
   * @param {Object} client - Cliente de transação opcional.
   */
  async updateBalance(walletId, amount, client = null) {
    const executor = client || this.db;
    const query = `
      UPDATE ${this.tableName}
      SET balance_available = balance_available + $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const { rows } = await executor.query(query, [amount, walletId]);
    return rows[0];
  }

  /**
   * Bloqueia fundos para uma partida ou torneio (Move de disponível para bloqueado).
   * @param {string} walletId 
   * @param {number} amount 
   * @param {Object} client 
   */
  async lockFunds(walletId, amount, client = null) {
    const executor = client || this.db;
    const query = `
      UPDATE ${this.tableName}
      SET balance_available = balance_available - $1,
          balance_locked = balance_locked + $1,
          updated_at = NOW()
      WHERE id = $2 AND balance_available >= $1
      RETURNING *
    `;
    const { rows } = await executor.query(query, [amount, walletId]);
    return rows[0] || null;
  }

  /**
   * Libera fundos bloqueados de volta para o saldo disponível (ex: cancelamento de partida).
   */
  async releaseFunds(walletId, amount, client = null) {
    const executor = client || this.db;
    const query = `
      UPDATE ${this.tableName}
      SET balance_locked = balance_locked - $1,
          balance_available = balance_available + $1,
          updated_at = NOW()
      WHERE id = $2 AND balance_locked >= $1
      RETURNING *
    `;
    const { rows } = await executor.query(query, [amount, walletId]);
    return rows[0];
  }

  /**
   * Consome definitivamente fundos que já estavam bloqueados (ex: após derrota).
   */
  async spendLockedFunds(walletId, amount, client = null) {
    const executor = client || this.db;
    const query = `
      UPDATE ${this.tableName}
      SET balance_locked = balance_locked - $1,
          updated_at = NOW()
      WHERE id = $2 AND balance_locked >= $1
      RETURNING *
    `;
    const { rows } = await executor.query(query, [amount, walletId]);
    return rows[0];
  }

  /**
   * Verifica se o usuário possui saldo suficiente.
   */
  async hasBalance(userId, amount) {
    const query = `
      SELECT (balance_available >= $1) as has_funds 
      FROM ${this.tableName} 
      WHERE user_id = $2
    `;
    const { rows } = await this.db.query(query, [amount, userId]);
    return rows.length > 0 && rows[0].has_funds;
  }
}

module.exports = new WalletsRepository();