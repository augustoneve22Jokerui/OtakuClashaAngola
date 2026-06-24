/**
 * 📊 OTAKU CLASH ANGOLA - ADMIN REPOSITORY
 * Versão: 2.0.0 - Enterprise Resilience
 * Descrição: Camada de persistência para KPIs, Auditoria e métricas globais.
 */

const BaseRepository = require('../../core/base/BaseRepository');
const logger = require('../../config/logger');

class AdminRepository extends BaseRepository {
  constructor() {
    // Atua sobre profiles, mas realiza queries multi-tabelas
    super('public.profiles'); 
  }

  /**
   * 📈 OBTÉM ESTATÍSTICAS GLOBAIS (DASHBOARD OVERVIEW)
   * Centraliza as métricas principais em uma única chamada de alta performance.
   */
  async getGlobalStats() {
    const query = `
      SELECT 
        (SELECT COUNT(*) FROM public.profiles) as total_users,
        (SELECT COUNT(*) FROM public.profiles WHERE last_seen > NOW() - INTERVAL '15 minutes') as online_count,
        (SELECT COUNT(*) FROM public.matches WHERE status = 'FINISHED') as total_matches,
        (SELECT COUNT(*) FROM public.matches WHERE status = 'IN_PROGRESS') as active_matches,
        COALESCE((SELECT SUM(balance_available + balance_locked) FROM public.wallets), 0) as total_circulating_balance,
        (SELECT COUNT(*) FROM public.animes) as total_animes,
        (SELECT COUNT(*) FROM public.questions) as total_questions
    `;

    try {
      const { rows } = await this.db.query(query);
      const stats = rows[0];

      return {
        totalUsers: parseInt(stats.total_users || 0),
        onlineCount: parseInt(stats.online_count || 0),
        totalMatches: parseInt(stats.total_matches || 0),
        activeMatches: parseInt(stats.active_matches || 0),
        totalCirculatingKz: parseFloat(stats.total_circulating_balance || 0),
        catalogSize: {
          animes: parseInt(stats.total_animes || 0),
          questions: parseInt(stats.total_questions || 0)
        },
        growth: {
          users: 12.5, // Em produção real, calcular via comparação com mês anterior
          revenue: 18.2
        }
      };
    } catch (error) {
      logger.error(`[AdminRepository:Stats] Falha ao calcular métricas: ${error.message}`);
      throw error;
    }
  }

  /**
   * 📑 BUSCA LOGS DE AUDITORIA COM PAGINAÇÃO
   */
  async findAuditLogs({ limit = 50, offset = 0, action = null, resourceType = null }) {
    let query = `
      SELECT al.*, p.username as admin_username 
      FROM public.audit_logs al
      LEFT JOIN public.profiles p ON al.user_id = p.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (action) {
      query += ` AND al.action = $${paramIndex++}`;
      params.push(action);
    }

    if (resourceType) {
      query += ` AND al.resource_type = $${paramIndex++}`;
      params.push(resourceType);
    }

    query += ` ORDER BY al.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    try {
      const { rows } = await this.db.query(query, params);
      return rows;
    } catch (error) {
      logger.error(`[AdminRepository:Audit] Falha ao buscar logs: ${error.message}`);
      return [];
    }
  }

  /**
   * 🕵️ REGISTRA AÇÃO ADMINISTRATIVA
   */
  async createAuditLog(logData) {
    const query = `
      INSERT INTO public.audit_logs (
        user_id, action, resource_type, resource_id, 
        old_values, new_values, ip_address, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id;
    `;
    
    const values = [
      logData.user_id,
      logData.action,
      logData.resource_type,
      logData.resource_id,
      logData.old_values ? JSON.stringify(logData.old_values) : null,
      logData.new_values ? JSON.stringify(logData.new_values) : null,
      logData.ip_address
    ];

    try {
      const { rows } = await this.db.query(query, values);
      return rows[0];
    } catch (error) {
      logger.error(`[AdminRepository:AuditLog] Falha ao persistir log: ${error.message}`);
      return null;
    }
  }

  /**
   * 💰 OBTÉM VOLUME FINANCEIRO SEMANAL PARA GRÁFICOS
   */
  async getTransactionVolumeWeekly() {
    const query = `
      SELECT 
        TO_CHAR(created_at, 'DD Mon') as date_label,
        type,
        SUM(amount) as total_amount,
        COUNT(*) as count
      FROM public.wallet_transactions
      WHERE created_at > NOW() - INTERVAL '7 days'
      AND status = 'COMPLETED'
      GROUP BY date_label, type, DATE_TRUNC('day', created_at)
      ORDER BY DATE_TRUNC('day', created_at) ASC
    `;

    try {
      const { rows } = await this.db.query(query);
      return rows;
    } catch (error) {
      logger.error(`[AdminRepository:Volume] Erro ao buscar histórico financeiro: ${error.message}`);
      return [];
    }
  }

  /**
   * 🛡️ ATUALIZA ROLE DE USUÁRIO (AUDITÁVEL)
   */
  async updateUserRole(userId, newRole) {
    const query = `
      UPDATE public.profiles 
      SET role = $1, updated_at = NOW() 
      WHERE id = $2 
      RETURNING id, username, role
    `;
    
    try {
      const { rows } = await this.db.query(query, [newRole, userId]);
      return rows[0];
    } catch (error) {
      logger.error(`[AdminRepository:Role] Erro ao atualizar permissão: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new AdminRepository();