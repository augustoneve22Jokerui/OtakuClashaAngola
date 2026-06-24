/**
 * 🕹️ OTAKU CLASH ANGOLA - ADMIN CONTROLLER
 * Versão: 2.1.0 - Enterprise Grade & System Settings Extended
 * Descrição: Gerencia requisições de alto nível para o Dashboard, Configurações de Sistema, 
 *            Controle de Acesso (RBAC), Auditoria e Manutenção de Infraestrutura.
 */

const BaseController = require('../../core/base/BaseController');
const adminService = require('./admin.service');
const db = require('../../config/database');
const logger = require('../../config/logger');

class AdminController extends BaseController {
  constructor() {
    super();
  }

  /**
   * 📊 DASHBOARD OVERVIEW
   * Retorna KPIs globais, métricas operacionais e atividade recente.
   * GET /api/v1/admin/dashboard
   */
  async getDashboard(req, res) {
    const stats = await adminService.getDashboardOverview();
    return this.success(res, stats, 'Indicadores do dashboard recuperados com sucesso.');
  }

  /**
   * ⚙️ GET SYSTEM SETTINGS
   * Busca os parâmetros globais de configuração na tabela pública do sistema.
   * GET /api/v1/admin/settings
   */
  async getSettings(req, res) {
    const { rows } = await db.query('SELECT * FROM public.system_settings LIMIT 1');
    const settings = rows[0] || {
      app_name: "Otaku Clash Angola",
      maintenance_mode: false,
      min_withdrawal: 1000,
      bonus_xp_multiplier: 1.0
    };
    return this.success(res, settings, 'Configurações globais do sistema recuperadas com sucesso.');
  }

  /**
   * 💾 UPDATE SYSTEM SETTINGS
   * Salva ou atualiza os parâmetros do sistema com UPSERT preventivo.
   * POST /api/v1/admin/settings
   */
  async updateSettings(req, res) {
    const data = req.body;
    const query = `
      INSERT INTO public.system_settings (id, app_name, maintenance_mode, updated_at)
      VALUES (1, $1, $2, NOW())
      ON CONFLICT (id) DO UPDATE SET
        app_name = EXCLUDED.app_name,
        maintenance_mode = EXCLUDED.maintenance_mode,
        updated_at = NOW()
      RETURNING *
    `;
    const { rows } = await db.query(query, [data.app_name, data.maintenance_mode || false]);
    return this.success(res, rows[0], 'Configurações operacionais salvas com sucesso.');
  }

  /**
   * 🛡️ ALTERAÇÃO DE PERMISSÃO (RBAC)
   * Altera a role de um utilizador registrando os dados de auditoria obrigatórios.
   * PATCH /api/v1/admin/users/:userId/role
   */
  async changeUserRole(req, res) {
    const { userId } = req.params;
    const { role } = req.body;
    const adminId = req.user.id;
    
    // Extração robusta do IP do administrador para trilha de auditoria digital
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0';

    const result = await adminService.changeUserRole(
      adminId, 
      userId, 
      role, 
      ipAddress
    );

    return this.success(res, result, `O nível de acesso do utilizador foi alterado para ${role} com sucesso.`);
  }

  /**
   * 📑 LISTAGEM DE AUDITORIA
   * Retorna os logs transacionais da aplicação com suporte a paginação e filtros.
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

    return this.success(res, logs, 'Registos de auditoria recuperados com metadados de paginação.');
  }

  /**
   * 🔍 INTEGRIDADE DO CATÁLOGO
   * Analisa e reporta a saúde relacional do catálogo e mídias associadas.
   * GET /api/v1/admin/catalog/health
   */
  async getCatalogHealth(req, res) {
    const healthReport = await adminService.getCatalogHealth();
    return this.success(res, healthReport, 'Relatório completo de integridade do catálogo gerado.');
  }

  /**
   * 🔄 TRIGGER DE SINCRONIZAÇÃO (MANUAL / BACKGROUND AUTOMATION)
   * Dispara o processamento assíncrono de importação via Jikan / TMDB sem travar a thread HTTP.
   * POST /api/v1/admin/sync/animes
   */
  async triggerAnimeSync(req, res) {
    const { malId } = req.body;
    
    // Isolamento dinâmico do serviço para evitar acoplamento temporal no boot
    const AnimeSyncService = require('../../services/jikan/AnimeSyncService');
    const syncService = new AnimeSyncService();
    
    if (malId) {
      // Sincronização de uma única obra em thread paralela
      syncService.syncSingleAnime(parseInt(malId)).catch(err => {
        logger.error(`[Admin:Sync] Falha na sync manual em background do ID ${malId}: ${err.message}`);
      });
      return this.success(res, null, `Sincronização direcionada para o MAL ID ${malId} inicializada com sucesso.`);
    }

    // Sincronização completa da temporada atual do ecossistema japonês
    syncService.syncSeasonAnimes().catch(err => {
      logger.error(`[Admin:Sync] Falha no fluxo assíncrono da temporada atual: ${err.message}`);
    });

    return this.success(res, null, 'Varredura e sincronização da temporada atual disparada em segundo plano.');
  }

  /**
   * 🧹 MANUTENÇÃO DE MEMÓRIA (CACHE VOLÁTIL VIA REDIS)
   * Expura chaves sob demanda limpando escopos específicos ou totais da infraestrutura.
   * POST /api/v1/admin/maintenance/clear-cache
   */
  async clearCache(req, res) {
    const { type } = req.body; // ALL, MATCHMAKING, SESSIONS, SYSTEM_SETTINGS etc.
    const targetType = type || 'ALL';
    
    await adminService.clearSystemCache(targetType);
    
    return this.success(res, null, `O cache operacional do sistema para [${targetType}] foi limpo com sucesso.`);
  }
}

module.exports = new AdminController();
