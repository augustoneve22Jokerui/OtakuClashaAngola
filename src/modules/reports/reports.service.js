/**
 * 🚩 OTAKU CLASH ANGOLA - REPORTS SERVICE
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Orquestrador de denúncias, moderação de conduta e gestão de feedback.
 */

const BaseService = require('../../core/base/BaseService');
const reportsRepository = require('./reports.repository');
const adminRepository = require('../admin/admin.repository');
const notificationsService = require('../notifications/notifications.service');
const AppError = require('../../core/errors/AppError');
const logger = require('../../config/logger');

class ReportsService extends BaseService {
  constructor() {
    super(reportsRepository);
  }

  /**
   * 📝 CRIA UM NOVO RELATO (PLAYER ACTION)
   * Suporta denúncias de jogadores, bugs e feedbacks de sistema.
   */
  async createReport(reporterId, data) {
    const { reported_id, type, description, metadata } = data;

    // 1. Validação de Negócio: Impede o auto-reporte
    if (reported_id && reported_id === reporterId) {
      throw AppError.badRequest('Não podes denunciar a ti mesmo.');
    }

    // 2. Proteção Anti-Spam: Verifica duplicatas nas últimas 24h para o mesmo alvo
    if (reported_id) {
      const isDuplicate = await this.repository.checkRecentDuplicate(reporterId, reported_id);
      if (isDuplicate) {
        throw AppError.conflict('Já enviaste uma denúncia contra este utilizador recentemente. Aguarda a análise.');
      }
    }

    try {
      const report = await this.repository.create({
        reporter_id: reporterId,
        reported_id: reported_id || null,
        type,
        description: description.trim(),
        metadata: metadata ? JSON.stringify(metadata) : null,
        status: 'PENDING'
      });

      logger.info(`[Reports:New] Relato [${type}] criado por ${reporterId}`);
      return report;

    } catch (error) {
      logger.error(`[ReportsService:Create] Falha: ${error.message}`);
      throw error;
    }
  }

  /**
   * 📑 LISTAGEM PARA MODERAÇÃO (STAFF ONLY)
   */
  async listReports(filters) {
    try {
      const { status, type, page = 1, limit = 20 } = filters;
      const offset = (page - 1) * limit;

      const items = await this.repository.findFiltered({
        status,
        type,
        limit,
        offset
      });

      const total = await this.repository.count(status ? { status } : {});

      return {
        items,
        pagination: { total, page: parseInt(page), limit: parseInt(limit) }
      };
    } catch (error) {
      logger.error(`[ReportsService:List] Erro: ${error.message}`);
      throw error;
    }
  }

  /**
   * ✅ RESOLUÇÃO DE TICKET (MODERATOR ACTION)
   * Processa o veredito do moderador e encerra o ticket.
   */
  async resolve(moderatorId, reportId, payload, ipAddress) {
    const { status, resolution_note } = payload;

    const report = await this.repository.findById(reportId);
    if (!report) throw AppError.notFound('Relato não localizado.');

    if (report.status !== 'PENDING') {
      throw AppError.badRequest('Este ticket já foi processado anteriormente.');
    }

    return await this.executeInTransaction(async (client) => {
      // 1. Atualiza o status do ticket
      const updatedReport = await this.repository.resolveReport(reportId, {
        status,
        resolution_note,
        resolved_by: moderatorId
      }, client);

      // 2. Registro de Auditoria (STAFF TRACEABILITY)
      await adminRepository.createAuditLog({
        user_id: moderatorId,
        action: `RESOLVE_REPORT_${status}`,
        resource_type: 'REPORT',
        resource_id: reportId,
        old_values: { status: 'PENDING' },
        new_values: { status, resolution_note },
        ip_address: ipAddress
      });

      // 3. Ciclo de Feedback: Notifica o autor do relato se for BUG ou FEEDBACK
      if (status === 'RESOLVED' && ['BUG', 'FEEDBACK'].includes(report.type)) {
        notificationsService.notify({
          userId: report.reporter_id,
          title: '📢 Relato Processado',
          message: `O teu feedback sobre "${report.type}" foi analisado e resolvido pela STAFF. Obrigado por ajudar o Otaku Clash!`,
          type: 'SYSTEM',
          metadata: { reportId: report.id }
        }).catch(err => logger.warn(`[Reports:Notify] Falha ao avisar reporter: ${err.message}`));
      }

      logger.info(`[Moderation] Ticket ${reportId} marcado como ${status} por ${moderatorId}`);
      return updatedReport;
    });
  }

  /**
   * 📊 RESUMO DE ATIVIDADE PARA O DASHBOARD
   */
  async getSummary() {
    try {
      const pendingStats = await this.repository.getPendingSummary();
      
      // Mapeia para um formato de objeto amigável ao Frontend
      const summary = {
        total_pending: 0,
        by_type: {}
      };

      pendingStats.forEach(stat => {
        summary.by_type[stat.type] = parseInt(stat.count);
        summary.total_pending += parseInt(stat.count);
      });

      return {
        pending: summary,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return { pending: { total_pending: 0 }, timestamp: new Date().toISOString() };
    }
  }

  /**
   * 🔍 BUSCA DETALHES TÉCNICOS DO RELATO
   */
  async getReportDetails(reportId) {
    const report = await this.repository.findDetailedById(reportId);
    if (!report) throw AppError.notFound('Relato não encontrado.');
    return report;
  }
}

module.exports = new ReportsService();