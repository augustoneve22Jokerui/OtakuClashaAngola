/**
 * 🕹️ OTAKU CLASH ANGOLA - ADMIN CONTROLLER
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Gerencia requisições de alto nível para o Dashboard e Monitoramento.
 */

const BaseController = require('../../core/base/BaseController');
const adminService = require('./admin.service');
const logger = require('../../config/logger');

class AdminController extends BaseController {
  constructor() {
    super();
  }

  /**
   * 📊 DASHBOARD OVERVIEW
   * Retorna KPIs globais e atividade financeira recente.
   * GET /api/v1/admin/dashboard
   */
  async getDashboard(req, res) {
    // adminService já agrega stats e recentActivity
    const stats = await adminService.getDashboardOverview();
    
    return this.success(res, stats, 'Indicadores do dashboard recuperados com sucesso.');
  }

  /**
   * 🛡️ ALTERAÇÃO DE PERMISSÃO (RBAC)
   * PATCH /api/v1/admin/users/:userId/role
   */
  async changeUserRole(req, res) {
    const { userId } = req.params;
    const { role } = req.body;
    const adminId = req.user.id;
    
    // Extração robusta do IP do administrador para auditoria
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0';

    const result = await adminService.changeUserRole(
      adminId, 
      userId, 
      role, 
      ipAddress
    );

    return this.success(res, result, `O nível de acesso do utilizador foi alterado para ${role}.`);
  }

  /**
   * 📑 LISTAGEM DE AUDITORIA
   * GET /api/v1/admin/audit-logs
   */
  async getAuditLogs(req, res) {
    const { page, limit, action, resourceType } = req.query;
    
    const logs = await adminService.getAuditLogs({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
      action,
      resourceType
    });

    // Como os logs podem ser volumosos, retornamos com metadados de paginação
    // O total é gerenciado internamente pelo service/repository
    return this.success(res, logs, 'Registos de auditoria recuperados.');
  }

  /**
   * 🔍 INTEGRIDADE DO CATÁLOGO
   * GET /api/v1/admin/catalog/health
   */
  async getCatalogHealth(req, res) {
    const healthReport = await adminService.getCatalogHealth();
    return this.success(res, healthReport, 'Relatório de saúde do catálogo gerado.');
  }

  /**
   * 🔄 TRIGGER DE SINCRONIZAÇÃO (MANUAL)
   * POST /api/v1/admin/sync/animes
   */
  async triggerAnimeSync(req, res) {
    const { malId } = req.body;
    
    // Import dinâmico para evitar dependência circular pesada no boot
    const AnimeSyncService = require('../../services/jikan/AnimeSyncService');
    const syncService = new AnimeSyncService();
    
    if (malId) {
      // Sincronização de um único anime (Promessa resolvida em background ou await)
      syncService.syncSingleAnime(parseInt(malId)).catch(err => {
        logger.error(`[Admin:Sync] Falha na sync manual do ID ${malId}: ${err.message}`);
      });
      return this.success(res, null, `Sincronização do MAL ID ${malId} iniciada em segundo plano.`);
    }

    // Sincronização da temporada
    syncService.syncSeasonAnimes().catch(err => {
      logger.error(`[Admin:Sync] Falha na sync da temporada: ${err.message}`);
    });

    return this.success(res, null, 'Sincronização da temporada iniciada em segundo plano.');
  }

  /**
   * 🧹 MANUTENÇÃO DE MEMÓRIA (CACHE)
   * POST /api/v1/admin/maintenance/clear-cache
   */
  async clearCache(req, res) {
    const { type } = req.body; // ALL, MATCHMAKING, SESSIONS, etc.
    
    await adminService.clearSystemCache(type || 'ALL');
    
    return this.success(res, null, `O cache do sistema [${type || 'TOTAL'}] foi limpo com sucesso.`);
  }
}

module.exports = new AdminController();