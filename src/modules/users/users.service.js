/**
 * 👥 OTAKU CLASH ANGOLA - USERS SERVICE (ADMIN)
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Lógica de negócio para gestão de contas, moderação e auditoria de utilizadores.
 */

const BaseService = require('../../core/base/BaseService');
const usersRepository = require('./users.repository');
const adminRepository = require('../admin/admin.repository');
const AppError = require('../../core/errors/AppError');
const logger = require('../../config/logger');

class UsersService extends BaseService {
  constructor() {
    super(usersRepository);
  }

  /**
   * 📑 LISTAGEM ADMINISTRATIVA DE UTILIZADORES
   * Retorna dados consolidados (Perfil + Auth) com paginação.
   */
  async listUsersAdmin(filters) {
    try {
      const { search, role, status, page = 1, limit = 10 } = filters;
      const offset = (page - 1) * limit;

      // 1. Busca os itens filtrados no repositório
      const items = await this.repository.findWithFilters({
        search,
        role,
        status,
        limit,
        offset
      });

      // 2. Obtém o total para metadados de paginação
      const total = await this.repository.countWithFilters({ search, role });

      return {
        items,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit)
        }
      };
    } catch (error) {
      logger.error(`[UsersService:List] Falha na listagem: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🔍 OBTÉM PERFIL COMPLETO (360º VIEW)
   * Integra dados do PostgreSQL e metadados do Supabase Auth.
   */
  async getFullUser(userId) {
    const user = await this.repository.findFullById(userId);

    if (!user) {
      throw AppError.notFound('Utilizador não localizado no ecossistema.');
    }

    // Formata o objeto para o DTO/Frontend
    return {
      account: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isConfirmed: user.confirmed_at !== null,
        lastLogin: user.last_sign_in_at,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        isSuspended: user.metaData?.suspended === true
      },
      profile: {
        username: user.username,
        fullName: user.full_name,
        avatarUrl: user.avatar_url,
        xp: parseInt(user.xp || 0),
        level: parseInt(user.level || 1),
        isOnline: user.is_online,
        lastSeen: user.last_seen
      }
    };
  }

  /**
   * 🚫 MODERAÇÃO: ALTERAR STATUS DE SUSPENSÃO
   * @param {string} adminId - Quem está realizando a ação.
   * @param {string} userId - Alvo da ação.
   * @param {boolean} suspended - Novo estado.
   * @param {string} reason - Justificativa para log.
   */
  async toggleAccountSuspension(adminId, userId, suspended, reason, ipAddress) {
    const targetUser = await this.repository.findById(userId);
    if (!targetUser) throw AppError.notFound('Utilizador não encontrado.');

    try {
      // 1. Atualiza metadados no Supabase Auth (Onde o login é validado)
      await this.repository.updateAccountMetadata(userId, {
        suspended: suspended,
        suspension_reason: reason,
        suspended_at: suspended ? new Date().toISOString() : null,
        suspended_by: suspended ? adminId : null
      });

      // 2. Registra ação nos Logs de Auditoria do Sistema
      await adminRepository.createAuditLog({
        user_id: adminId,
        action: suspended ? 'SUSPEND_USER' : 'REACTIVATE_USER',
        resource_type: 'USER',
        resource_id: userId,
        old_values: { suspended: !suspended },
        new_values: { suspended, reason },
        ip_address: ipAddress
      });

      logger.warn(`[Moderation] Usuário ${targetUser.username} teve status alterado para SUSPENDED=${suspended} por ${adminId}`);

      return {
        id: userId,
        username: targetUser.username,
        isSuspended: suspended,
        updatedAt: new Date()
      };
    } catch (error) {
      logger.error(`[UsersService:Moderation] Falha ao processar suspensão: ${error.message}`);
      throw AppError.internal('Não foi possível atualizar o status da conta no provedor de identidade.');
    }
  }

  /**
   * 📊 ESTATÍSTICAS RÁPIDAS (DASHBOARD WIDGETS)
   */
  async getRecentRegistrations(limit = 5) {
    try {
      return await this.repository.findRecent(limit);
    } catch (error) {
      logger.error(`[UsersService:Stats] Erro ao buscar recentes: ${error.message}`);
      return [];
    }
  }

  /**
   * 🛡️ VALIDAÇÃO DE INTEGRIDADE DE USERNAME
   */
  async isUsernameAvailable(username, excludeUserId = null) {
    const existing = await this.repository.findOneByField('username', username);
    if (!existing) return true;
    return existing.id === excludeUserId;
  }
}

module.exports = new UsersService();