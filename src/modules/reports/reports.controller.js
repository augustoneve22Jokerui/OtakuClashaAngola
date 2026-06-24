/**
 * 🚩 OTAKU CLASH ANGOLA - REPORTS CONTROLLER
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Gerencia requisições de denúncias de utilizadores, bugs e feedbacks de sistema.
 */

const BaseController = require('../../core/base/BaseController');
const reportsService = require('./reports.service');
const logger = require('../../config/logger');

class ReportsController extends BaseController {
  constructor() {
    super();
  }

  /**
   * 📝 CRIAR NOVO RELATO (PLAYER ACTION)
   * POST /api/v1/reports
   */
  async create(req, res) {
    const reporterId = req.user.id;
    const { reported_id, type, description, metadata } = req.body;

    const report = await reportsService.createReport(reporterId, {
      reported_id,
      type,
      description,
      metadata
    });

    return this.created(
      res, 
      report, 
      'Obrigado! O teu relato foi enviado e será analisado pela nossa equipa de moderação.'
    );
  }

  /**
   * 📑 LISTAGEM PARA MODERAÇÃO (STAFF ONLY)
   * GET /api/v1/reports
   */
  async list(req, res) {
    const { status, type, page, limit } = req.query;

    const result = await reportsService.listReports({
      status,
      type,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });

    // Retorna utilizando o método de paginação padronizado da BaseController
    return this.paginate(res, result.items, result.pagination);
  }

  /**
   * ✅ RESOLVER TICKET (STAFF ACTION)
   * PATCH /api/v1/reports/:id/resolve
   */
  async resolve(req, res) {
    const moderatorId = req.user.id;
    const { id: reportId } = req.params;
    const { status, resolution_note } = req.body; // status: 'RESOLVED' ou 'DISMISSED'

    // Captura o IP do moderador para o log de auditoria
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0';

    const updatedReport = await reportsService.resolve(
      moderatorId,
      reportId,
      { status, resolution_note },
      ipAddress
    );

    const actionText = status === 'RESOLVED' ? 'concluído' : 'rejeitado';
    return this.success(res, updatedReport, `O ticket foi marcado como ${actionText}.`);
  }

  /**
   * 📊 RESUMO DE PENDÊNCIAS (DASHBOARD WIDGET)
   * GET /api/v1/reports/summary
   */
  async getSummary(req, res) {
    const summary = await reportsService.getSummary();
    return this.success(res, summary, 'Resumo de moderação recuperado.');
  }

  /**
   * 🔍 DETALHES TÉCNICOS DO RELATO
   * GET /api/v1/reports/:id
   */
  async getDetails(req, res) {
    const { id } = req.params;
    
    const report = await reportsService.getReportDetails(id);
    
    return this.success(res, report, 'Ficha técnica do relato recuperada.');
  }
}

module.exports = new ReportsController();