const BaseService = require('../../core/base/BaseService');
const guildsRepository = require('./guilds.repository');
const AppError = require('../../core/errors/AppError');
const logger = require('../../config/logger');
const db = require('../../config/database');

/**
 * GuildsService - Gerencia a lógica de clãs, membros e progressão social.
 */
class GuildsService extends BaseService {
  constructor() {
    super(guildsRepository);
    this.creationCost = 5000; // Custo fixo em AKZ para criar uma guilda
  }

  /**
   * Cria uma nova guilda.
   * Requer saldo na carteira e que o usuário não pertença a outra guilda.
   */
  async createGuild(ownerId, data) {
    const { name, tag, description, logo_url } = data;

    return await this.executeInTransaction(async (client) => {
      // 1. Verifica se o usuário já está em uma guilda
      const existingUserGuild = await this.repository.getUserGuild(ownerId);
      if (existingUserGuild) {
        throw AppError.badRequest('Você já pertence a uma guilda.');
      }

      // 2. Verifica unicidade de nome e tag
      const conflict = await this.repository.findByNameOrTag(name, tag.toUpperCase());
      if (conflict) {
        throw AppError.conflict('Nome ou TAG da guilda já estão em uso.');
      }

      // 3. Verifica e debita saldo da carteira
      const { rows: [wallet] } = await client.query(
        'SELECT id, balance_available FROM public.wallets WHERE user_id = $1 FOR UPDATE',
        [ownerId]
      );

      if (!wallet || parseFloat(wallet.balance_available) < this.creationCost) {
        throw AppError.badRequest(`Saldo insuficiente. Criar uma guilda custa ${this.creationCost} AKZ.`);
      }

      await client.query(
        'UPDATE public.wallets SET balance_available = balance_available - $1 WHERE id = $2',
        [this.creationCost, wallet.id]
      );

      // 4. Registra transação financeira
      await client.query(
        `INSERT INTO public.wallet_transactions (wallet_id, amount, direction, type, status, description)
         VALUES ($1, $2, 'DEBIT', 'GUILD_CREATION', 'COMPLETED', $3)`,
        [wallet.id, this.creationCost, `Criação da guilda ${name} [${tag}]`]
      );

      // 5. Cria a guilda
      const guild = await this.repository.create({
        name,
        tag: tag.toUpperCase(),
        description,
        logo_url,
        leader_id: ownerId,
        member_count: 1,
        max_members: 20
      });

      // 6. Adiciona o criador como Líder
      await this.repository.addMember(guild.id, ownerId, 'LEADER', client);

      logger.info(`[GuildsService] Guilda criada: ${name} por ${ownerId}`);
      return guild;
    });
  }

  /**
   * Processa o pedido de entrada em uma guilda.
   */
  async joinGuild(userId, guildId) {
    const guild = await this.repository.findById(guildId);
    if (!guild) throw AppError.notFound('Guilda não encontrada.');

    if (guild.member_count >= guild.max_members) {
      throw AppError.badRequest('A guilda está lotada.');
    }

    const alreadyInGuild = await this.repository.getUserGuild(userId);
    if (alreadyInGuild) throw AppError.badRequest('Você já pertence a uma guilda.');

    return await this.repository.addMember(guildId, userId, 'MEMBER');
  }

  /**
   * Lógica para sair de uma guilda.
   */
  async leaveGuild(userId, guildId) {
    const userGuild = await this.repository.getUserGuild(userId);
    
    if (!userGuild || userGuild.id !== guildId) {
      throw AppError.badRequest('Você não pertence a esta guilda.');
    }

    if (userGuild.leader_id === userId) {
      throw AppError.badRequest('O líder não pode sair sem transferir a liderança ou excluir a guilda.');
    }

    return await this.repository.removeMember(guildId, userId);
  }

  /**
   * Promove ou rebaixa um membro.
   */
  async updateMemberRank(adminId, guildId, targetUserId, newRank) {
    const adminStatus = await this.repository.getUserGuild(adminId);
    
    if (!adminStatus || adminStatus.id !== guildId || adminStatus.rank !== 'LEADER') {
      throw AppError.forbidden('Apenas o líder pode gerenciar ranks.');
    }

    if (newRank === 'LEADER') {
      throw AppError.badRequest('Para transferir a liderança, use o endpoint de transferência.');
    }

    return await this.repository.updateMemberRank(guildId, targetUserId, newRank);
  }

  /**
   * Obtém detalhes completos da guilda e membros.
   */
  async getFullDetails(guildId) {
    const guild = await this.repository.findByIdWithLeader(guildId);
    if (!guild) throw AppError.notFound('Guilda não encontrada.');

    const members = await this.repository.findMembers(guildId);
    
    return {
      ...guild,
      members
    };
  }

  /**
   * Adiciona XP à guilda por atividades dos membros.
   */
  async awardGuildXP(guildId, amount) {
    try {
      return await this.repository.addExperience(guildId, amount);
    } catch (error) {
      logger.error(`[GuildsService] Erro ao premiar XP à guilda: ${error.message}`);
    }
  }
}

module.exports = new GuildsService();