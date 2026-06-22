const BaseController = require('../../core/base/BaseController');
const usersService = require('./users.service');
const UsersDTO = require('./users.dto');

/**
 * UsersController - Controlador para operações administrativas de usuários.
 */
class UsersController extends BaseController {
  constructor() {
    super();
  }

  /**
   * Lista usuários com filtros administrativos e paginação.
   * GET /api/v1/users
   */
  async list(req, res) {
    const { search, role, page, limit } = req.query;

    const result = await usersService.listUsersAdmin({
      search,
      role,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });

    const transformedItems = UsersDTO.transformManyAdmin(result.items);

    return this.paginate(res, transformedItems, result.pagination);
  }

  /**
   * Obtém detalhes completos de um usuário (Perfil + Dados de Autenticação).
   * GET /api/v1/users/:id
   */
  async getDetails(req, res) {
    const { id } = req.params;

    const user = await usersService.getFullUser(id);
    const transformed = UsersDTO.transformFull(user);

    return this.success(res, transformed, 'Dados completos do usuário recuperados.');
  }

  /**
   * Suspende ou reativa a conta de um usuário.
   * PATCH /api/v1/users/:id/status
   */
  async toggleStatus(req, res) {
    const { id: userId } = req.params;
    const { suspended, reason } = req.body;

    const updatedUser = await usersService.toggleAccountSuspension(
      userId, 
      suspended, 
      reason || 'Ação administrativa'
    );

    return this.success(
      res, 
      UsersDTO.transformAdmin(updatedUser), 
      `Status da conta atualizado para ${suspended ? 'SUSPENSO' : 'ATIVO'}.`
    );
  }

  /**
   * Obtém a lista de registros recentes para o dashboard administrativo.
   * GET /api/v1/users/admin/recent
   */
  async getRecent(req, res) {
    const { limit } = req.query;
    
    const users = await usersService.getRecentRegistrations(parseInt(limit) || 5);
    const transformed = UsersDTO.transformMany(users);

    return this.success(res, transformed, 'Registros recentes recuperados.');
  }
}

module.exports = new UsersController();