/**
 * 👥 OTAKU CLASH ANGOLA - USERS CONTROLLER (ADMIN)
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Gerencia as requisições de administração de contas e moderação.
 */

const BaseController = require('../../core/base/BaseController');
const usersService = require('./users.service');
const logger = require('../../config/logger');

class UsersController extends BaseController {
  constructor() {
    super();
  }

  /**
   * 📑 LISTAGEM GLOBAL DE UTILIZADORES
   * GET /api/v1/users
   */
  async list(req, res) {
    const { search, role, status, page, limit } = req.query;

    const result = await usersService.listUsersAdmin({
      search,
      role,
      status,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10
    });

    // Retorna utilizando o método de paginação padronizado da BaseController
    return this.paginate(res, result.items, result.pagination);
  }

  /**
   * 🔍 DETALHES COMPLETOS DO UTILIZADOR
   * GET /api/v1/users/:id
   */
  async getDetails(req, res) {
    const { id } = req.params;

    const userDetails = await usersService.getFullUser(id);

    return this.success(res, userDetails, 'Dados detalhados do utilizador recuperados.');
  }

  /**
   * 🚫 ALTERAR STATUS DA CONTA (SUSPENDER/ATIVAR)
   * PATCH /api/v1/users/:id/status
   */
  async toggleStatus(req, res) {
    const { id: userId } = req.params;
    const { suspended, reason } = req.body;
    const adminId = req.user.id;

    // Captura o IP do administrador para os logs de auditoria
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0';

    const updatedStatus = await usersService.toggleAccountSuspension(
      adminId,
      userId,
      suspended,
      reason || 'Ação administrativa manual',
      ipAddress
    );

    const actionText = suspended ? 'suspensa' : 'activada';
    return this.success(res, updatedStatus, `A conta do utilizador foi ${actionText} com sucesso.`);
  }

  /**
   * 📊 UTILIZADORES RECENTES (DASHBOARD WIDGET)
   * GET /api/v1/users/admin/recent
   */
  async getRecent(req, res) {
    const { limit } = req.query;

    const users = await usersService.getRecentRegistrations(parseInt(limit) || 5);

    return this.success(res, users, 'Lista de registos recentes recuperada.');
  }

  /**
   * 🛡️ VERIFICAR DISPONIBILIDADE DE USERNAME
   * GET /api/v1/users/check-username
   */
  async checkUsername(req, res) {
    const { username, excludeId } = req.query;

    if (!username) {
      return this.success(res, { available: false }, 'Username não fornecido.');
    }

    const isAvailable = await usersService.isUsernameAvailable(username, excludeId);

    return this.success(res, { available: isAvailable });
  }

  /**
   * 🏆 ESTATÍSTICAS DE JOGO DO UTILIZADOR
   * GET /api/v1/users/:id/stats
   */
  async getStats(req, res) {
    const { id } = req.params;
    
    // Import dinâmico do ProfilesRepository para buscar estatísticas competitivas
    const profilesRepository = require('../profiles/profiles.repository');
    const stats = await profilesRepository.getProfileStats(id);

    return this.success(res, stats, 'Estatísticas de performance recuperadas.');
  }
}

module.exports = new UsersController();