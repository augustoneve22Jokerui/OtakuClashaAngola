const BaseService = require('../../core/base/BaseService');
const reportsRepository = require('./reports.repository');
const AppError = require('../../core/errors/AppError');
const logger = require('../../config/logger');

/**
 * ReportsService - Orquestra a lógica de denúncias e feedbacks dos usuários.
 */
class ReportsService extends BaseService {
  constructor() {
    super(reportsRepository);
  }

  /**
   * Cria uma nova denúncia ou relato.
   * @param {string} reporterId - Usuário que está reportando.
   * @param {Object} reportData - { reported_id, type, description, metadata }
   */
  async createReport(reporterId, reportData) {
    const { reported_id, type, description, metadata } = reportData;

    // 1. Impede que o usuário se denuncie
    if (reported_id && reporterId === reported_id) {
      throw AppError.badRequest('Você não pode denunciar a si mesmo.');
    }

    // 2. Proteção Anti-Spam: Verifica se já existe uma denúncia idêntica nas últimas 24h
    if (reported_id) {
      const isDuplicate = await this.repository.checkDuplicateReport(reporterId, reported_id);
      if (isDuplicate) {
        throw AppError.conflict('Você já enviou uma denúncia contra este usuário recentemente. Aguarde a análise.');
      }
    }

    try {
      const report = await this.repository.create({
        reporter_id: reporterId,
        reported_id: reported_id || null,
        type,
        description,
        metadata: metadata ? JSON.stringify(metadata) : null,
        status: 'PENDING'
      });

      logger.info(`[ReportsService] Novo relato [${type}] criado por ${reporterId}`);

      // Opcional: Aqui poderia ser disparado um evento para o Socket.IO para notificar Admins online
      
      return report;
    } catch (error) {
      logger.error(`[ReportsService] Erro ao criar relato: ${error.message}`);
      throw error;
    }
  }

  /**
   * Lista denúncias para moderação com filtros.
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
        pagination: {
          total,
          page,
          limit
        }
      };
    } catch (error) {
      logger.error(`[ReportsService] Erro ao listar relatos: ${error.message}`);
      throw error;
    }
  }

  /**
   * Resolve uma denúncia mudando seu status.
   * @param {string} adminId - ID do administrador realizando a ação.
   * @param {string} reportId - ID da denúncia.
   * @param {string} status - Novo status (RESOLVED, DISMISSED).
   */
  async resolveReport(adminId, reportId, status) {
    const report = await this.repository.findById(reportId);
    if (!report) {
      throw AppError.notFound('Relato não encontrado.');
    }

    if (report.status !== 'PENDING') {
      throw AppError.badRequest('Este relato já foi processado anteriormente.');
    }

    try {
      const updatedReport = await this.repository.updateStatus(reportId, status, adminId);
      
      logger.info(`[ReportsService] Relato ${reportId} marcado como ${status} pelo Admin ${adminId}`);

      // Se o relato for um BUG ou FEEDBACK, poderíamos notificar o reporter_id sobre a resolução
      if (status === 'RESOLVED' && (report.type === 'BUG' || report.type === 'FEEDBACK')) {
        const notificationsService = require('../notifications/notifications.service');
        await notificationsService.notify({
          userId: report.reporter_id,
          title: 'Relato Processado',
          message: 'Agradecemos o seu contato. O seu relato foi analisado e resolvido pela nossa equipe.',
          type: 'SYSTEM'
        });
      }

      return updatedReport;
    } catch (error) {
      logger.error(`[ReportsService] Erro ao resolver relato: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtém um resumo das pendências para o dashboard admin.
   */
  async getSummary() {
    const counts = await this.repository.countPendingByType();
    return {
      pending: counts,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new ReportsService();