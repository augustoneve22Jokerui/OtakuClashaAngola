const BaseRepository = require('../../core/base/BaseRepository');

/**
 * UsersRepository - Camada de acesso a dados para gestão administrativa de usuários.
 * Opera sobre a tabela public.profiles, que está vinculada ao auth.users do Supabase.
 */
class UsersRepository extends BaseRepository {
  constructor() {
    super('public.profiles');
  }

  /**
   * Busca usuários com filtros administrativos (email, role, status).
   * @param {Object} filters - { search, role, limit, offset }
   */
  async findWithFilters({ search, role, limit = 20, offset = 0 }) {
    let query = `
      SELECT p.*, au.email, au.last_sign_in_at, au.confirmed_at
      FROM ${this.tableName} p
      JOIN auth.users au ON p.id = au.id
      WHERE 1=1
    `;
    const values = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      query += ` AND (p.username ILIKE $${paramCount} OR au.email ILIKE $${paramCount} OR p.full_name ILIKE $${paramCount})`;
      values.push(`%${search}%`);
    }

    if (role) {
      paramCount++;
      query += ` AND p.role = $${paramCount}`;
      values.push(role);
    }

    query += ` ORDER BY p.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    values.push(limit, offset);

    const { rows } = await this.db.query(query, values);
    return rows;
  }

  /**
   * Conta usuários baseados nos filtros para paginação.
   */
  async countWithFilters({ search, role }) {
    let query = `
      SELECT COUNT(*) as total
      FROM ${this.tableName} p
      JOIN auth.users au ON p.id = au.id
      WHERE 1=1
    `;
    const values = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      query += ` AND (p.username ILIKE $${paramCount} OR au.email ILIKE $${paramCount})`;
      values.push(`%${search}%`);
    }

    if (role) {
      paramCount++;
      query += ` AND p.role = $${paramCount}`;
      values.push(role);
    }

    const { rows } = await this.db.query(query, values);
    return parseInt(rows[0].total, 10);
  }

  /**
   * Obtém detalhes completos de um usuário (Perfil + Dados de Conta Auth).
   * @param {string} userId 
   */
  async findFullById(userId) {
    const query = `
      SELECT p.*, au.email, au.last_sign_in_at, au.confirmed_at, au.phone
      FROM ${this.tableName} p
      JOIN auth.users au ON p.id = au.id
      WHERE p.id = $1
      LIMIT 1
    `;
    const { rows } = await this.db.query(query, [userId]);
    return rows[0] || null;
  }

  /**
   * Atualiza o status de banimento ou restrição (lógica customizada via metadata).
   */
  async updateAccountStatus(userId, statusData) {
    // Note: Geralmente banimentos são controlados por colunas extras no profile
    // ou via metadados no auth.users do Supabase.
    const query = `
      UPDATE ${this.tableName}
      SET updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const { rows } = await this.db.query(query, [userId]);
    return rows[0];
  }

  /**
   * Busca usuários recém registrados.
   */
  async findRecentRegistrations(limit = 5) {
    const query = `
      SELECT id, username, avatar_url, created_at
      FROM ${this.tableName}
      ORDER BY created_at DESC
      LIMIT $1
    `;
    const { rows } = await this.db.query(query, [limit]);
    return rows;
  }
}

module.exports = new UsersRepository();