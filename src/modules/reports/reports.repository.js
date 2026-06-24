/**
 * 🚩 OTAKU CLASH ANGOLA - REPORTS REPOSITORY
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Gestão de persistência para denúncias, bugs, feedbacks e moderação.
 */

const BaseRepository = require('../../core/base/BaseRepository');
const logger = require('../../config/logger');

class ReportsRepository extends BaseRepository {
  constructor() {
    super('public.reports');
  }

  /**
   * 📋 LISTAGEM FILTRADA COM IDENTIDADES (ADMIN VIEW)
   * Realiza JOIN com perfis para exibir nomes em vez de apenas UUIDs.
   * @param {Object} params - { status, type, limit, offset }
   */
  async findFiltered({ status, type, limit = 20, offset = 0 }) {
    let query = `
      SELECT 
        r.*, 
        p1.username as "reporterUsername", 
        p1.avatar_url as "reporterAvatar",
        p2.username as "reportedUsername",
        p2.avatar_url as "reportedAvatar"
      FROM public.reports r
      LEFT JOIN public.profiles p1 ON r.reporter_id = p1.id
      LEFT JOIN public.profiles p2 ON r.reported_id = p2.id
      WHERE 1=1
    `;

    const values = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND r.status = $${paramIndex++}`;
      values.push(status);
    }

    if (type) {
      query += ` AND r.type = $${paramIndex++}`;
      values.push(type);
    }

    query += ` ORDER BY r.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    values.push(limit, offset);

    try {
      const { rows } = await this.db.query(query, values);
      return rows;
    } catch (error) {
      logger.error(`[ReportsRepo:findFiltered] Erro: ${error.message}`);
      return [];
    }
  }

  /**
   * 📊 RESUMO DE PENDÊNCIAS (DASHBOARD)
   * Conta denúncias por tipo para os widgets do moderador.
   */
  async getPendingSummary() {
    const query = `
      SELECT 
        type, 
        COUNT(*) as count 
      FROM public.reports 
      WHERE status = 'PENDING' 
      GROUP BY type
    `;
    
    try {
      const { rows } = await this.db.query(query);
      return rows;
    } catch (error) {
      logger.error(`[ReportsRepo:Summary] Falha: ${error.message}`);
      return [];
    }
  }

  /**
   * ✅ ATUALIZA STATUS E RESOLUÇÃO
   * @param {string} reportId 
   * @param {Object} data - { status, resolution_note, resolved_by }
   */
  async resolveReport(reportId, data, client = null) {
    const query = `
      UPDATE ${this.tableName}
      SET 
        status = $1, 
        resolution_note = $2, 
        resolved_by = $3,
        resolved_at = NOW(),
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `;

    const values = [
      data.status,
      data.resolution_note || null,
      data.resolved_by,
      reportId
    ];

    try {
      const executor = client || this.db;
      const { rows } = await executor.query(query, values);
      return rows[0] || null;
    } catch (error) {
      logger.error(`[ReportsRepo:Resolve] Erro ao fechar ticket ${reportId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🆔 BUSCA DETALHADA COM HISTÓRICO
   */
  async findDetailedById(reportId) {
    const query = `
      SELECT 
        r.*, 
        p1.username as "reporterUsername", 
        p2.username as "reportedUsername",
        p3.username as "moderatorUsername"
      FROM public.reports r
      LEFT JOIN public.profiles p1 ON r.reporter_id = p1.id
      LEFT JOIN public.profiles p2 ON r.reported_id = p2.id
      LEFT JOIN public.profiles p3 ON r.resolved_by = p3.id
      WHERE r.id = $1
      LIMIT 1
    `;
    
    try {
      const { rows } = await this.db.query(query, [reportId]);
      return rows[0] || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 🛡️ VERIFICA SPAM DE DENÚNCIAS
   * Impede que um utilizador denuncie o mesmo alvo repetidamente em 24h.
   */
  async checkRecentDuplicate(reporterId, reportedId) {
    const query = `
      SELECT id FROM ${this.tableName}
      WHERE reporter_id = $1 AND reported_id = $2
      AND created_at > NOW() - INTERVAL '24 hours'
      LIMIT 1
    `;
    try {
      const { rows } = await this.db.query(query, [reporterId, reportedId]);
      return rows.length > 0;
    } catch (error) {
      return false;
    }
  }
}

module.exports = new ReportsRepository();