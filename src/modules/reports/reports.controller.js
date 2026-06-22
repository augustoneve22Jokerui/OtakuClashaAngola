const BaseController = require('../../core/base/BaseController');
const reportsService = require('./reports.service');

/**
 * ReportsController - Controlador para gestão de denúncias, bugs e feedbacks.
 */
class ReportsController extends BaseController {
  constructor() {
    super();
  }

  /**
   * Cria um novo relato (Denúncia, Bug ou Feedback).
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

    return this.created(res, report, 'Obrigado! Seu relato foi enviado com sucesso e será analisado pela nossa equipe.');
  }

  /**
   * Lista os relatos recebidos (Apenas para MODERATOR/ADMIN).
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

    return this.paginate(res, result.items, result.pagination);
  }

  /**
   * Atualiza o status de um relato (Apenas para MODERATOR/ADMIN).
   * PATCH /api/v1/reports/:id/resolve
   */
  async resolve(req, res) {
    const adminId = req.user.id;
    const { id: reportId } = req.params;
    const { status } = req.body; // RESOLVED ou DISMISSED

    const updatedReport = await reportsService.resolveReport(adminId, reportId, status);

    return this.success(res, updatedReport, `Relato processado como ${status}.`);
  }

  /**
   * Obtém um resumo de relatos pendentes para o dashboard.
   * GET /api/v1/reports/summary
   */
  async getSummary(req, res) {
    const summary = await reportsService.getSummary();
    return this.success(res, summary, 'Resumo de relatos recuperado.');
  }

  /**
   * Obtém detalhes de um relato específico.
   * GET /api/v1/reports/:id
   */
  async getDetails(req, res) {
    const { id } = req.params;
    const report = await reportsService.findById(id);
    
    // Adiciona usernames se existirem via join no service/repository (já contemplado no repository)
    return this.success(res, report);
  }
}

module.exports = new ReportsController();