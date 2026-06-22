const BaseRepository = require('../../core/base/BaseRepository');

/**
 * ReportsRepository - Camada de acesso a dados para o sistema de denúncias e relatos.
 * Nota: Assume a existência da tabela public.reports (id, reporter_id, reported_id, type, status, description, metadata, created_at).
 */
class ReportsRepository extends BaseRepository {
  constructor() {
    super('public.reports');
  }

  /**
   * Busca denúncias com filtros de status e tipo.
   * @param {Object} params - { status, type, limit, offset }
   */
  async findFiltered({ status, type, limit = 20, offset = 0 }) {
    let query = `
      SELECT r.*, 
             p1.username as reporter_username, 
             p2.username as reported_username
      FROM ${this.tableName} r
      LEFT JOIN public.profiles p1 ON r.reporter_id = p1.id
      LEFT JOIN public.profiles p2 ON r.reported_id = p2.id
      WHERE 1=1
    `;
    const values = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      query += ` AND r.status = $${paramCount}`;
      values.push(status);
    }

    if (type) {
      paramCount++;
      query += ` AND r.type = $${paramCount}`;
      values.push(type);
    }

    query += ` ORDER BY r.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    values.push(limit, offset);

    const { rows } = await this.db.query(query, values);
    return rows;
  }

  /**
   * Atualiza o status de uma denúncia (ex: de PENDING para RESOLVED).
   * @param {string} reportId 
   * @param {string} status 
   * @param {string} adminId - ID do administrador que resolveu
   */
  async updateStatus(reportId, status, adminId) {
    const query = `
      UPDATE ${this.tableName}
      SET status = $1, 
          resolved_at = NOW(), 
          resolved_by = $2,
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;
    const { rows } = await this.db.query(query, [status, adminId, reportId]);
    return rows[0];
  }

  /**
   * Conta denúncias pendentes por tipo.
   */
  async countPendingByType() {
    const query = `
      SELECT type, COUNT(*) as count 
      FROM ${this.tableName} 
      WHERE status = 'PENDING' 
      GROUP BY type
    `;
    const { rows } = await this.db.query(query);
    return rows;
  }

  /**
   * Verifica se um usuário já denunciou outro em um curto período (anti-spam).
   * @param {string} reporterId 
   * @param {string} reportedId 
   */
  async checkDuplicateReport(reporterId, reportedId) {
    const query = `
      SELECT id FROM ${this.tableName}
      WHERE reporter_id = $1 AND reported_id = $2
      AND created_at > NOW() - INTERVAL '24 hours'
      LIMIT 1
    `;
    const { rows } = await this.db.query(query, [reporterId, reportedId]);
    return rows.length > 0;
  }
}

module.exports = new ReportsRepository();