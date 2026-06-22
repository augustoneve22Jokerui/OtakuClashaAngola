const BaseRepository = require('../../core/base/BaseRepository');
const { TransactionStatus } = require('../../core/constants/TransactionTypes');

/**
 * TransactionsRepository - Camada de acesso a dados para histórico financeiro.
 * Gerencia a tabela public.wallet_transactions.
 */
class TransactionsRepository extends BaseRepository {
  constructor() {
    super('public.wallet_transactions');
  }

  /**
   * Busca transações vinculadas a um usuário específico através da carteira.
   * @param {string} userId - UUID do usuário.
   * @param {Object} filters - { type, status, limit, offset }
   */
  async findByUserId(userId, { type, status, limit = 20, offset = 0 }) {
    let query = `
      SELECT t.* 
      FROM ${this.tableName} t
      JOIN public.wallets w ON t.wallet_id = w.id
      WHERE w.user_id = $1
    `;
    const values = [userId];
    let paramCount = 1;

    if (type) {
      paramCount++;
      query += ` AND t.type = $${paramCount}`;
      values.push(type);
    }

    if (status) {
      paramCount++;
      query += ` AND t.status = $${paramCount}`;
      values.push(status);
    }

    query += ` ORDER BY t.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    values.push(limit, offset);

    const { rows } = await this.db.query(query, values);
    return rows;
  }

  /**
   * Conta o total de transações de um usuário para paginação.
   */
  async countByUserId(userId, { type, status }) {
    let query = `
      SELECT COUNT(*) as total 
      FROM ${this.tableName} t
      JOIN public.wallets w ON t.wallet_id = w.id
      WHERE w.user_id = $1
    `;
    const values = [userId];
    let paramCount = 1;

    if (type) {
      paramCount++;
      query += ` AND t.type = $${paramCount}`;
      values.push(type);
    }

    if (status) {
      paramCount++;
      query += ` AND t.status = $${paramCount}`;
      values.push(status);
    }

    const { rows } = await this.db.query(query, values);
    return parseInt(rows[0].total, 10);
  }

  /**
   * Busca detalhes de uma transação validando a propriedade do usuário.
   */
  async findByIdAndUser(transactionId, userId) {
    const query = `
      SELECT t.* 
      FROM ${this.tableName} t
      JOIN public.wallets w ON t.wallet_id = w.id
      WHERE t.id = $1 AND w.user_id = $2
      LIMIT 1
    `;
    const { rows } = await this.db.query(query, [transactionId, userId]);
    return rows[0] || null;
  }

  /**
   * Obtém estatísticas financeiras do usuário (Total de Entradas vs Saídas).
   */
  async getUserFinancialSummary(userId) {
    const query = `
      SELECT 
        direction,
        SUM(amount) as total_amount,
        COUNT(*) as count
      FROM ${this.tableName} t
      JOIN public.wallets w ON t.wallet_id = w.id
      WHERE w.user_id = $1 AND t.status = $2
      GROUP BY direction
    `;
    const { rows } = await this.db.query(query, [userId, TransactionStatus.COMPLETED]);
    return rows;
  }

  /**
   * Busca transações recentes de todo o sistema para o dashboard administrativo.
   */
  async findGlobalRecent(limit = 50) {
    const query = `
      SELECT t.*, p.username, p.avatar_url
      FROM ${this.tableName} t
      JOIN public.wallets w ON t.wallet_id = w.id
      JOIN public.profiles p ON w.user_id = p.id
      ORDER BY t.created_at DESC
      LIMIT $1
    `;
    const { rows } = await this.db.query(query, [limit]);
    return rows;
  }

  /**
   * Atualiza o status de uma transação (ex: de PENDING para FAILED).
   */
  async updateStatus(transactionId, status, metadata = null) {
    const query = `
      UPDATE ${this.tableName}
      SET status = $1, 
          metadata = CASE WHEN $2::jsonb IS NOT NULL THEN metadata || $2::jsonb ELSE metadata END
      WHERE id = $3
      RETURNING *
    `;
    const { rows } = await this.db.query(query, [status, metadata ? JSON.stringify(metadata) : null, transactionId]);
    return rows[0];
  }
}

module.exports = new TransactionsRepository();