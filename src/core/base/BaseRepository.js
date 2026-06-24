/**
 * 🗄️ OTAKU CLASH ANGOLA - BASE REPOSITORY
 * Versão: 2.0.0 - Enterprise Resilient
 * Descrição: Abstração de persistência com suporte a PostgreSQL paramétrico e modo híbrido.
 */

const db = require('../../config/database');
const { supabaseAdmin } = require('../../config/supabase');
const logger = require('../../config/logger');

class BaseRepository {
  /**
   * @param {string} tableName - Nome da tabela (ex: 'public.profiles')
   */
  constructor(tableName) {
    this.tableName = tableName;
    this.db = db;
    this.supabase = supabaseAdmin;
  }

  /**
   * 🏛️ OBTÉM CLIENTE PARA TRANSAÇÃO
   * Utilizado para garantir a atomicidade de operações complexas.
   */
  async getTransactionClient() {
    return await this.db.getClient();
  }

  /**
   * 🔍 BUSCA TODOS (COM PAGINAÇÃO)
   */
  async findAll({ limit = 10, offset = 0, orderBy = 'created_at', order = 'DESC' } = {}) {
    const query = `
      SELECT * FROM ${this.tableName}
      ORDER BY ${orderBy} ${order}
      LIMIT $1 OFFSET $2
    `;
    
    try {
      const res = await this.db.query(query, [limit, offset]);
      return res ? res.rows : [];
    } catch (error) {
      logger.error(`[BaseRepo:findAll] Erro em ${this.tableName}: ${error.message}`);
      return [];
    }
  }

  /**
   * 🆔 BUSCA POR ID
   */
  async findById(id) {
    if (!id) return null;
    const query = `SELECT * FROM ${this.tableName} WHERE id = $1 LIMIT 1`;
    
    try {
      const res = await this.db.query(query, [id]);
      return res && res.rows.length > 0 ? res.rows[0] : null;
    } catch (error) {
      logger.error(`[BaseRepo:findById] Erro em ${this.tableName}: ${error.message}`);
      return null;
    }
  }

  /**
   * 🎯 BUSCA POR CAMPO ESPECÍFICO
   */
  async findOneByField(field, value) {
    if (!value) return null;
    const query = `SELECT * FROM ${this.tableName} WHERE ${field} = $1 LIMIT 1`;
    
    try {
      const res = await this.db.query(query, [value]);
      return res && res.rows.length > 0 ? res.rows[0] : null;
    } catch (error) {
      logger.error(`[BaseRepo:findOneByField] Erro em ${this.tableName}: ${error.message}`);
      return null;
    }
  }

  /**
   * 🧱 INSERÇÃO DINÂMICA
   * @param {Object} data - Objeto contendo coluna: valor
   * @param {Object} client - Opcional: Cliente de transação
   */
  async create(data, client = null) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const columns = keys.join(', ');

    const query = `
      INSERT INTO ${this.tableName} (${columns})
      VALUES (${placeholders})
      RETURNING *
    `;

    try {
      const executor = client || this.db;
      const res = await executor.query(query, values);
      return res ? res.rows[0] : null;
    } catch (error) {
      logger.error(`[BaseRepo:create] Erro em ${this.tableName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🔄 ATUALIZAÇÃO DINÂMICA
   */
  async update(id, data, client = null) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    
    const setClause = keys
      .map((key, i) => `${key} = $${i + 1}`)
      .join(', ');

    const query = `
      UPDATE ${this.tableName}
      SET ${setClause}, updated_at = NOW()
      WHERE id = $${keys.length + 1}
      RETURNING *
    `;

    try {
      const executor = client || this.db;
      const res = await executor.query(query, [...values, id]);
      return res ? res.rows[0] : null;
    } catch (error) {
      logger.error(`[BaseRepo:update] Erro em ${this.tableName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🗑️ REMOÇÃO
   */
  async delete(id, client = null) {
    const query = `DELETE FROM ${this.tableName} WHERE id = $1 RETURNING id`;
    
    try {
      const executor = client || this.db;
      const res = await executor.query(query, [id]);
      return res && res.rows.length > 0;
    } catch (error) {
      logger.error(`[BaseRepo:delete] Erro em ${this.tableName}: ${error.message}`);
      return false;
    }
  }

  /**
   * 🔢 CONTAGEM DE REGISTROS
   */
  async count(filters = {}) {
    let query = `SELECT COUNT(*) as total FROM ${this.tableName}`;
    const keys = Object.keys(filters);
    const values = Object.values(filters);

    if (keys.length > 0) {
      const whereClause = keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');
      query += ` WHERE ${whereClause}`;
    }

    try {
      const res = await this.db.query(query, values);
      return res ? parseInt(res.rows[0].total, 10) : 0;
    } catch (error) {
      logger.error(`[BaseRepo:count] Erro em ${this.tableName}: ${error.message}`);
      return 0;
    }
  }

  /**
   * 🧩 UPSERT DINÂMICO (INSERT ON CONFLICT)
   * Especialmente útil para sincronização de animes e personagens.
   */
  async upsert(data, conflictTarget, client = null) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const columns = keys.join(', ');
    
    const updateClause = keys
      .map((key) => `${key} = EXCLUDED.${key}`)
      .join(', ');

    const query = `
      INSERT INTO ${this.tableName} (${columns})
      VALUES (${placeholders})
      ON CONFLICT (${conflictTarget}) DO UPDATE SET
        ${updateClause},
        updated_at = NOW()
      RETURNING *
    `;

    try {
      const executor = client || this.db;
      const res = await executor.query(query, values);
      return res ? res.rows[0] : null;
    } catch (error) {
      logger.error(`[BaseRepo:upsert] Erro em ${this.tableName}: ${error.message}`);
      throw error;
    }
  }
}

module.exports = BaseRepository;