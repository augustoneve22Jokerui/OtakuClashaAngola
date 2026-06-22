const BaseRepository = require('../../core/base/BaseRepository');

/**
 * AdminRepository - Camada de persistência para funções administrativas e auditoria.
 */
class AdminRepository extends BaseRepository {
  constructor() {
    super('public.profiles'); // Tabela base, mas atua em múltiplas
  }

  /**
   * Registra uma ação administrativa no log de auditoria.
   * @param {Object} logData - { user_id, action, resource_type, resource_id, old_values, new_values, ip_address }
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
    const { rows } = await this.db.query(query, values);
    return rows[0];
  }

  /**
   * Obtém estatísticas globais do sistema (Dashboard Overview).
   */
  async getGlobalStats() {
    const query = `
      SELECT 
        (SELECT COUNT(*) FROM public.profiles) as total_users,
        (SELECT COUNT(*) FROM public.matches WHERE status = 'FINISHED') as total_matches,
        (SELECT SUM(balance_available) FROM public.wallets) as total_circulating_balance,
        (SELECT COUNT(*) FROM public.animes) as total_animes,
        (SELECT COUNT(*) FROM public.questions) as total_questions
    `;
    const { rows } = await this.db.query(query);
    return {
      totalUsers: parseInt(rows[0].total_users),
      totalMatches: parseInt(rows[0].total_matches),
      totalCirculatingKz: parseFloat(rows[0].total_circulating_balance || 0),
      catalogSize: {
        animes: parseInt(rows[0].total_animes),
        questions: parseInt(rows[0].total_questions)
      }
    };
  }

  /**
   * Busca logs de auditoria com paginação e filtros.
   */
  async findAuditLogs({ limit = 50, offset = 0, action = null }) {
    let query = `
      SELECT al.*, p.username as admin_username 
      FROM public.audit_logs al
      LEFT JOIN public.profiles p ON al.user_id = p.id
    `;
    const params = [limit, offset];
    
    if (action) {
      query += ` WHERE al.action = $3`;
      params.push(action);
    }
    
    query += ` ORDER BY al.created_at DESC LIMIT $1 OFFSET $2`;
    
    const { rows } = await this.db.query(query, params);
    return rows;
  }

  /**
   * Altera a role de um usuário.
   */
  async updateUserRole(userId, newRole) {
    const query = `
      UPDATE public.profiles 
      SET role = $1, updated_at = NOW() 
      WHERE id = $2 
      RETURNING id, username, role
    `;
    const { rows } = await this.db.query(query, [newRole, userId]);
    return rows[0];
  }

  /**
   * Obtém o volume de transações financeiras dos últimos 7 dias.
   */
  async getTransactionVolumeWeekly() {
    const query = `
      SELECT 
        DATE_TRUNC('day', created_at) as date,
        type,
        SUM(amount) as total_amount,
        COUNT(*) as transaction_count
      FROM public.wallet_transactions
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY date, type
      ORDER BY date DESC
    `;
    const { rows } = await this.db.query(query);
    return rows;
  }
}

module.exports = new AdminRepository();