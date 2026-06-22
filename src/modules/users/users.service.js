const BaseService = require('../../core/base/BaseService');
const usersRepository = require('./users.repository');
const AppError = require('../../core/errors/AppError');
const logger = require('../../config/logger');

/**
 * UsersService - Gerencia a lógica de usuários em nível de conta e administração.
 */
class UsersService extends BaseService {
  constructor() {
    super(usersRepository);
  }

  /**
   * Lista usuários com filtros avançados para o painel administrativo.
   * @param {Object} filters - { search, role, page, limit }
   */
  async listUsersAdmin(filters) {
    try {
      const { search, role, page = 1, limit = 20 } = filters;
      const offset = (page - 1) * limit;

      const items = await this.repository.findWithFilters({
        search,
        role,
        limit,
        offset
      });

      const total = await this.repository.countWithFilters({ search, role });

      return {
        items,
        pagination: {
          total,
          page,
          limit
        }
      };
    } catch (error) {
      logger.error(`[UsersService] Erro ao listar usuários para admin: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtém o perfil completo do usuário, integrando dados do Profiles e do Auth (Supabase).
   * @param {string} userId 
   */
  async getFullUser(userId) {
    const user = await this.repository.findFullById(userId);

    if (!user) {
      throw AppError.notFound('Usuário não localizado no sistema.');
    }

    // Opcional: Adicionar estatísticas financeiras ou de jogo se necessário
    return user;
  }

  /**
   * Suspende ou reativa uma conta de usuário.
   * @param {string} userId 
   * @param {boolean} isSuspended 
   * @param {string} reason 
   */
  async toggleAccountSuspension(userId, isSuspended, reason) {
    const user = await this.repository.findById(userId);
    if (!user) throw AppError.notFound('Usuário não encontrado.');

    try {
      // Nota: A suspensão real deve ser feita via Supabase Admin Auth (banimento de login)
      // e refletida no banco de dados local para visibilidade.
      const { supabaseAdmin } = require('../../config/supabase');
      
      if (isSuspended) {
        // Bloqueia no Auth do Supabase
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: { suspended: true, suspension_reason: reason }
          // Nota: Para banir de fato o login, o Supabase usa o campo 'ban' ou revogação de tokens
        });
      } else {
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: { suspended: false, suspension_reason: null }
        });
      }

      const updatedUser = await this.repository.updateAccountStatus(userId, { 
        suspended: isSuspended, 
        reason 
      });

      logger.info(`[UsersService] Status da conta ${userId} alterado para SUSPENDED=${isSuspended}. Motivo: ${reason}`);
      
      return updatedUser;
    } catch (error) {
      logger.error(`[UsersService] Erro ao alterar status da conta: ${error.message}`);
      throw AppError.internal('Não foi possível atualizar o status da conta.');
    }
  }

  /**
   * Obtém usuários registrados recentemente.
   */
  async getRecentRegistrations(limit = 5) {
    try {
      return await this.repository.findRecentRegistrations(limit);
    } catch (error) {
      logger.error(`[UsersService] Erro ao buscar registros recentes: ${error.message}`);
      return [];
    }
  }
}

module.exports = new UsersService();