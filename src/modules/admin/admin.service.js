/**
 * 🛠️ OTAKU CLASH ANGOLA - ADMIN SERVICE
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Orquestrador de operações administrativas, auditoria e KPIs.
 */

const BaseService = require('../../core/base/BaseService');
const adminRepository = require('./admin.repository');
const AppError = require('../../core/errors/AppError');
const logger = require('../../config/logger');

class AdminService extends BaseService {
  constructor() {
    super(adminRepository);
  }

  /**
   * 📈 GERA VISÃO GERAL DO DASHBOARD
   * Agrega estatísticas de usuários, finanças e catálogo.
   */
  async getDashboardOverview() {
    try {
      logger.debug('[AdminService] Gerando indicadores do dashboard...');

      // 1. Busca estatísticas globais (Contagens e Saldos)
      const stats = await this.repository.getGlobalStats();

      // 2. Busca volume financeiro dos últimos 7 dias para o gráfico
      const financialActivity = await this.repository.getTransactionVolumeWeekly();

      // 3. Estrutura os dados para o formato esperado pelo Dashboard.js
      return {
        overview: stats,
        recentActivity: financialActivity,
        timestamp: new Date().toISOString(),
        serverStatus: 'OPERATIONAL'
      };

    } catch (error) {
      logger.error(`[AdminService:Dashboard] Falha na agregação: ${error.message}`);
      throw new AppError('Não foi possível carregar os dados do dashboard.', 500);
    }
  }

  /**
   * 🛡️ ALTERA PERMISSÃO DE USUÁRIO (AUDITADO)
   * @param {string} adminId - ID do administrador logado.
   * @param {string} targetUserId - ID do usuário alvo.
   * @param {string} newRole - Role (ADMIN, MODERATOR, USER).
   * @param {string} ipAddress - IP da requisição.
   */
  async changeUserRole(adminId, targetUserId, newRole, ipAddress) {
    // 1. Busca estado atual para auditoria
    const targetUser = await this.repository.findById(targetUserId);
    
    if (!targetUser) {
      throw AppError.notFound('O utilizador alvo não foi localizado no sistema.');
    }

    if (targetUser.role === newRole) {
      throw AppError.badRequest('O utilizador já possui este nível de acesso.');
    }

    const oldRole = targetUser.role;

    // 2. Executa a transação de atualização
    const updatedUser = await this.repository.updateUserRole(targetUserId, newRole);

    // 3. Registra nos Logs de Auditoria (Background)
    this.repository.createAuditLog({
      user_id: adminId,
      action: 'CHANGE_USER_ROLE',
      resource_type: 'USER',
      resource_id: targetUserId,
      old_values: { role: oldRole },
      new_values: { role: newRole },
      ip_address: ipAddress
    }).catch(err => logger.error(`[AuditLog:Fail] ${err.message}`));

    logger.info(`[AdminAction] Role alterada: ${targetUser.username} (${oldRole} -> ${newRole}) por ${adminId}`);

    return updatedUser;
  }

  /**
   * 📑 LISTA LOGS DE AUDITORIA
   */
  async getAuditLogs(filters) {
    const { page = 1, limit = 50, action, resourceType } = filters;
    const offset = (page - 1) * limit;

    try {
      const logs = await this.repository.findAuditLogs({
        limit,
        offset,
        action,
        resourceType
      });

      return logs;
    } catch (error) {
      logger.error(`[AdminService:AuditLogs] Erro ao buscar logs: ${error.message}`);
      throw new AppError('Erro ao recuperar registros de auditoria.', 500);
    }
  }

  /**
   * 🔍 RELATÓRIO DE SAÚDE DO CATÁLOGO
   * Identifica animes que precisam de atenção (sem questões ou personagens).
   */
  async getCatalogHealth() {
    try {
      const report = await this.repository.getCatalogHealth();
      
      // Mapeia e classifica o nível de atenção
      return report.map(item => ({
        ...item,
        status: parseInt(item.question_count) === 0 ? 'CRITICAL' : 'WARNING',
        needsSync: parseInt(item.char_count) === 0
      }));
    } catch (error) {
      logger.error(`[AdminService:CatalogHealth] Erro: ${error.message}`);
      return [];
    }
  }

  /**
   * 🧹 MANUTENÇÃO: LIMPEZA DE CACHE (DASHBOARD ACTION)
   */
  async clearSystemCache(type = 'ALL') {
    const cacheProvider = require('../../config/hybridRedis');
    
    try {
      if (type === 'ALL') {
        // No modo fallback limpa o Map, no Redis usa flush (se permitido)
        if (cacheProvider.enabled) {
          await cacheProvider.client.flushdb();
        } else {
          cacheProvider.client._storage.clear();
        }
      } else {
        // Limpeza por padrão (ex: matchmaking:*)
        const pattern = type.toLowerCase() + ':*';
        if (cacheProvider.enabled) {
          const keys = await cacheProvider.client.keys(pattern);
          if (keys.length > 0) await cacheProvider.client.del(...keys);
        }
      }
      
      logger.warn(`[AdminAction] Cache do sistema limpo via Painel Admin. Tipo: ${type}`);
      return true;
    } catch (error) {
      logger.error(`[AdminService:Cache] Falha ao limpar cache: ${error.message}`);
      throw new AppError('Falha ao processar limpeza de memória.', 500);
    }
  }
}

module.exports = new AdminService();