const BaseController = require('../../core/base/BaseController');
const adminService = require('./admin.service');
const { Roles } = require('../../core/constants/Roles');

/**
 * AdminController - Controlador para operações restritas de administração e monitoramento.
 */
class AdminController extends BaseController {
  constructor() {
    super();
  }

  /**
   * Obtém a visão geral do sistema (KPIs e Atividade Recente).
   * GET /api/v1/admin/dashboard
   */
  async getDashboard(req, res) {
    const stats = await adminService.getDashboardOverview();
    return this.success(res, stats, 'Dados do dashboard recuperados com sucesso.');
  }

  /**
   * Altera a role (permissão) de um usuário específico.
   * PATCH /api/v1/admin/users/:userId/role
   */
  async changeUserRole(req, res) {
    const { userId } = req.params;
    const { role } = req.body;
    const adminId = req.user.id;
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const result = await adminService.changeUserRole(
      adminId, 
      userId, 
      role, 
      ipAddress
    );

    return this.success(res, result, `Permissão do usuário alterada para ${role}.`);
  }

  /**
   * Lista os logs de auditoria do sistema.
   * GET /api/v1/admin/audit-logs
   */
  async getAuditLogs(req, res) {
    const { page, limit, action } = req.query;
    
    const logs = await adminService.getAuditLogs({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
      action
    });

    return this.success(res, logs, 'Logs de auditoria recuperados.');
  }

  /**
   * Retorna o relatório de saúde do catálogo de animes/questões.
   * GET /api/v1/admin/catalog/health
   */
  async getCatalogHealth(req, res) {
    const healthReport = await adminService.getCatalogHealth();
    return this.success(res, healthReport, 'Relatório de saúde do catálogo gerado.');
  }

  /**
   * Executa uma sincronização forçada de animes da temporada.
   * POST /api/v1/admin/sync/animes
   */
  async triggerAnimeSync(req, res) {
    const AnimeSyncService = require('../../services/jikan/AnimeSyncService');
    const syncService = new AnimeSyncService();
    
    // Executa em background para não travar a requisição
    syncService.syncSeasonAnimes().catch(err => {
      console.error('[AdminController] Falha na sincronização forçada:', err);
    });

    return this.success(res, null, 'Sincronização de animes iniciada em segundo plano.');
  }
}

module.exports = new AdminController();