/**
 * 📝 OTAKU CLASH ANGOLA - TRANSACTIONS REPOSITORY
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Camada de persistência para o Ledger (Livro Razão) financeiro.
 */

const BaseRepository = require('../../core/base/BaseRepository');
const { TransactionStatus } = require('../../core/constants/TransactionTypes');
const logger = require('../../config/logger');

class TransactionsRepository extends BaseRepository {
  constructor() {
    super('public.wallet_transactions');
  }

  /**
   * 🔍 BUSCA TRANSAÇÕES DE UM UTILIZADOR ESPECÍFICO
   * @param {string} userId 
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
    let paramIndex = 2;

    if (type) {
      query += ` AND t.type = $${paramIndex++}`;
      values.push(type);
    }

    if (status) {
      query += ` AND t.status = $${paramIndex++}`;
      values.push(status);
    }

    query += ` ORDER BY t.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    values.push(limit, offset);

    try {
      const { rows } = await this.db.query(query, values);
      return rows;
    } catch (error) {
      logger.error(`[TransactionsRepo:findByUserId] Erro: ${error.message}`);
      return [];
    }
  }

  /**
   * 🌍 BUSCA GLOBAL DE TRANSAÇÕES (ADMIN VIEW)
   * Integra dados de perfil para auditoria completa no Dashboard.
   */
  async findGlobalRecent({ type, status, limit = 50, offset = 0, search = null }) {
    let query = `
      SELECT 
        t.*, 
        p.username, 
        p.avatar_url,
        w.user_id as "ownerId"
      FROM ${this.tableName} t
      JOIN public.wallets w ON t.wallet_id = w.id
      JOIN public.profiles p ON w.user_id = p.id
      WHERE 1=1
    `;

    const values = [];
    let paramIndex = 1;

    if (type) {
      query += ` AND t.type = $${paramIndex++}`;
      values.push(type);
    }

    if (status) {
      query += ` AND t.status = $${paramIndex++}`;
      values.push(status);
    }

    if (search) {
      query += ` AND (p.username ILIKE $${paramIndex} OR t.reference_id ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex})`;
      values.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY t.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    values.push(limit, offset);

    try {
      const { rows } = await this.db.query(query, values);
      return rows;
    } catch (error) {
      logger.error(`[TransactionsRepo:findGlobal] Erro: ${error.message}`);
      return [];
    }
  }

  /**
   * 📊 RESUMO FINANCEIRO DO UTILIZADOR
   * Calcula totais de entrada e saída confirmados.
   */
  async getUserFinancialSummary(userId) {
    const query = `
      SELECT 
        direction,
        COALESCE(SUM(amount), 0) as "totalAmount",
        COUNT(*) as "count"
      FROM ${this.tableName} t
      JOIN public.wallets w ON t.wallet_id = w.id
      WHERE w.user_id = $1 
      AND t.status = 'COMPLETED'
      GROUP BY direction
    `;
    
    try {
      const { rows } = await this.db.query(query, [userId]);
      return rows;
    } catch (error) {
      logger.error(`[TransactionsRepo:Summary] Erro: ${error.message}`);
      return [];
    }
  }

  /**
   * 🆔 BUSCA TRANSAÇÃO COM VALIDAÇÃO DE POSSE
   */
  async findByIdAndUser(transactionId, userId) {
    const query = `
      SELECT t.* 
      FROM ${this.tableName} t
      JOIN public.wallets w ON t.wallet_id = w.id
      WHERE t.id = $1 AND w.user_id = $2
      LIMIT 1
    `;
    
    try {
      const { rows } = await this.db.query(query, [transactionId, userId]);
      return rows[0] || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 📈 CONTAGEM PARA PAGINAÇÃO (ADMIN)
   */
  async countGlobal({ type, status, search }) {
    let query = `
      SELECT COUNT(*) as total 
      FROM ${this.tableName} t
      JOIN public.wallets w ON t.wallet_id = w.id
      JOIN public.profiles p ON w.user_id = p.id
      WHERE 1=1
    `;
    
    const values = [];
    let paramIndex = 1;

    if (type) {
      query += ` AND t.type = $${paramIndex++}`;
      values.push(type);
    }

    if (status) {
      query += ` AND t.status = $${paramIndex++}`;
      values.push(status);
    }

    if (search) {
      query += ` AND (p.username ILIKE $${paramIndex} OR t.reference_id ILIKE $${paramIndex})`;
      values.push(`%${search}%`);
    }

    try {
      const { rows } = await this.db.query(query, values);
      return parseInt(rows[0].total, 10);
    } catch (error) {
      return 0;
    }
  }

  /**
   * 🔢 CONTAGEM PARA PAGINAÇÃO (USER)
   */
  async countByUserId(userId, { type, status }) {
    let query = `
      SELECT COUNT(*) as total 
      FROM ${this.tableName} t
      JOIN public.wallets w ON t.wallet_id = w.id
      WHERE w.user_id = $1
    `;
    
    const values = [userId];
    let paramIndex = 2;

    if (type) {
      query += ` AND t.type = $${paramIndex++}`;
      values.push(type);
    }

    if (status) {
      query += ` AND t.status = $${paramIndex++}`;
      values.push(status);
    }

    try {
      const { rows } = await this.db.query(query, values);
      return parseInt(rows[0].total, 10);
    } catch (error) {
      return 0;
    }
  }
}

module.exports = new TransactionsRepository();