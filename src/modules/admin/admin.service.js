const BaseService = require('../../core/base/BaseService');
const adminRepository = require('./admin.repository');
const AppError = require('../../core/errors/AppError');
const logger = require('../../config/logger');

/**
 * AdminService - Gerencia operações de alto nível, auditoria e monitoramento do sistema.
 */
class AdminService extends BaseService {
  constructor() {
    super(adminRepository);
  }

  /**
   * Obtém os dados consolidados para o dashboard administrativo.
   */
  async getDashboardOverview() {
    try {
      const stats = await this.repository.getGlobalStats();
      const financialVolume = await this.repository.getTransactionVolumeWeekly();

      return {
        overview: stats,
        recentActivity: financialVolume,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`[AdminService] Er de dashboard: ${error.message}`);
      throw new AppError('Falha ao gerar indicadores do dashboard.', 500);
    }
  }

  /**
   * Altera a permissão de um usuário e registra a auditoria.
   * @param {string} adminId - ID do administrador que realiza a ação.
   * @param {string} targetUserId - ID do usuário a ser modificado.
   * @param {string} newRole - Nova role (ADMIN, MODERATOR, USER).
   * @param {string} ipAddress - IP da requisição para auditoria.
   */
  async changeUserRole(adminId, targetUserId, newRole, ipAddress) {
    // 1. Busca usuário atual para logar o estado anterior
    const targetUser = await this.repository.findById(targetUserId);
    if (!targetUser) {
      throw AppError.notFound('Usuário alvo não encontrado.');
    }

    if (targetUser.role === newRole) {
      throw AppError.badRequest('O usuário já possui esta permissão.');
    }

    const oldRole = targetUser.role;

    // 2. Executa a atualização
    const updatedUser = await this.repository.updateUserRole(targetUserId, newRole);

    // 3. Registra auditoria de forma assíncrona
    this.repository.createAuditLog({
      user_id: adminId,
      action: 'CHANGE_USER_ROLE',
      resource_type: 'USER',
      resource_id: targetUserId,
      old_values: { role: oldRole },
      new_values: { role: newRole },
      ip_address: ipAddress
    }).catch(err => logger.error(`[AuditLog] Falha ao registrar ação admin: ${err.message}`));

    logger.info(`[AdminService] Admin ${adminId} alterou role de ${targetUserId} de ${oldRole} para ${newRole}`);

    return updatedUser;
  }

  /**
   * Retorna os logs de auditoria do sistema.
   */
  async getAuditLogs(filters) {
    try {
      const logs = await this.repository.findAuditLogs({
        limit: filters.limit || 50,
        offset: ((filters.page || 1) - 1) * (filters.limit || 50),
        action: filters.action
      });

      return logs;
    } catch (error) {
      logger.error(`[AdminService] Erro ao buscar logs: ${error.message}`);
      throw new AppError('Erro ao recuperar registros de auditoria.', 500);
    }
  }

  /**
   * Gera relatório de saúde do catálogo (Animes sem questões ou personagens).
   */
  async getCatalogHealth() {
    const query = `
      SELECT 
        a.id, a.title,
        (SELECT COUNT(*) FROM public.characters WHERE anime_id = a.id) as char_count,
        (SELECT COUNT(*) FROM public.questions WHERE anime_id = a.id) as question_count
      FROM public.animes a
      WHERE 
        (SELECT COUNT(*) FROM public.questions WHERE anime_id = a.id) < 5
      ORDER BY question_count ASC
      LIMIT 20
    `;
    const { rows } = await this.repository.db.query(query);
    return rows;
  }
}

module.exports = new AdminService();