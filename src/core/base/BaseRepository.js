const db = require('../../config/database');
const { supabaseAdmin } = require('../../config/supabase');

/**
 * BaseRepository - Classe base para persistência de dados.
 * Integra PostgreSQL nativo e Supabase Admin SDK.
 */
class BaseRepository {
  /**
   * @param {string} tableName - Nome da tabela no banco de dados.
   */
  constructor(tableName) {
    this.tableName = tableName;
    this.db = db;
    this.supabase = supabaseAdmin;
  }

  /**
   * Obtém um cliente do pool para iniciar uma transação.
   */
  async getDatabaseClient() {
    return await this.db.getClient();
  }

  /**
   * Busca todos os registros da tabela.
   * @param {Object} options - Filtros, ordenação e limite.
   */
  async findAll({ limit = 100, offset = 0, orderBy = 'created_at', order = 'DESC' } = {}) {
    const query = `
      SELECT * FROM ${this.tableName}
      ORDER BY ${orderBy} ${order}
      LIMIT $1 OFFSET $2
    `;
    const { rows } = await this.db.query(query, [limit, offset]);
    return rows;
  }

  /**
   * Busca um registro por ID.
   * @param {string|number} id 
   */
  async findById(id) {
    const query = `SELECT * FROM ${this.tableName} WHERE id = $1 LIMIT 1`;
    const { rows } = await this.db.query(query, [id]);
    return rows[0] || null;
  }

  /**
   * Busca um registro por um campo específico.
   * @param {string} field 
   * @param {any} value 
   */
  async findOneByField(field, value) {
    const query = `SELECT * FROM ${this.tableName} WHERE ${field} = $1 LIMIT 1`;
    const { rows } = await this.db.query(query, [value]);
    return rows[0] || null;
  }

  /**
   * Insere um novo registro de forma dinâmica.
   * @param {Object} data - Objeto contendo os pares coluna/valor.
   */
  async create(data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const columns = keys.join(', ');

    const query = `
      INSERT INTO ${this.tableName} (${columns})
      VALUES (${placeholders})
      RETURNING *
    `;

    const { rows } = await this.db.query(query, values);
    return rows[0];
  }

  /**
   * Atualiza um registro existente de forma dinâmica.
   * @param {string|number} id 
   * @param {Object} data 
   */
  async update(id, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');

    const query = `
      UPDATE ${this.tableName}
      SET ${setClause}, updated_at = NOW()
      WHERE id = $${keys.length + 1}
      RETURNING *
    `;

    const { rows } = await this.db.query(query, [...values, id]);
    return rows[0];
  }

  /**
   * Remove um registro.
   * @param {string|number} id 
   */
  async delete(id) {
    const query = `DELETE FROM ${this.tableName} WHERE id = $1 RETURNING id`;
    const { rows } = await this.db.query(query, [id]);
    return rows.length > 0;
  }

  /**
   * Conta o total de registros (útil para paginação).
   */
  async count(filters = {}) {
    let query = `SELECT COUNT(*) as total FROM ${this.tableName}`;
    const keys = Object.keys(filters);
    const values = Object.values(filters);

    if (keys.length > 0) {
      const whereClause = keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');
      query += ` WHERE ${whereClause}`;
    }

    const { rows } = await this.db.query(query, values);
    return parseInt(rows[0].total, 10);
  }
}

module.exports = BaseRepository;