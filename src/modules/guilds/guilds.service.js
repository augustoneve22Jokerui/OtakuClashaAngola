/**
 * 🛡️ OTAKU CLASH ANGOLA - GUILDS SERVICE
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Orquestrador de clãs, gestão de membros e progressão social.
 */

const BaseService = require('../../core/base/BaseService');
const guildsRepository = require('./guilds.repository');
const walletsService = require('../wallets/wallets.service');
const AppError = require('../../core/errors/AppError');
const logger = require('../../config/logger');

class GuildsService extends BaseService {
  constructor() {
    super(guildsRepository);
    this.GUILD_CREATION_COST = 5000; // Custo em AKZ para fundar um clã
    this.MAX_MEMBERS_DEFAULT = 20;   // Limite inicial de membros
  }

  /**
   * 🏗️ CRIA UMA NOVA GUILDA (TRANSACTIONAL)
   * Valida saldo, unicidade e cria o vínculo de liderança.
   */
  async createGuild(ownerId, data) {
    const { name, tag, description, logo_url } = data;

    return await this.executeInTransaction(async (client) => {
      // 1. Verifica se o utilizador já pertence a outra guilda
      const existingUserGuild = await this.repository.findByUserId(ownerId);
      if (existingUserGuild) {
        throw AppError.badRequest('Você já é membro de um clã. Saia do atual para fundar um novo.');
      }

      // 2. Verifica disponibilidade de Nome e TAG
      const isAvailable = await this.repository.checkAvailability(name, tag.toUpperCase());
      if (!isAvailable) {
        throw AppError.conflict('O nome ou a TAG informada já estão em uso por outra guilda.');
      }

      // 3. Processa Taxa de Fundação via WalletsService
      // O WalletsService já faz a validação de saldo e registra a transação
      await walletsService.debit(
        ownerId, 
        this.GUILD_CREATION_COST, 
        'GUILD_CREATION', 
        `Fundação da Guilda: ${name} [${tag.toUpperCase()}]`
      );

      // 4. Cria o registro da Guilda
      const guild = await this.repository.create({
        name,
        tag: tag.toUpperCase(),
        description,
        logo_url,
        leader_id: ownerId,
        member_count: 0, // Será incrementado pelo addMember abaixo
        max_members: this.MAX_MEMBERS_DEFAULT
      }, client);

      // 5. Adiciona o fundador como Líder
      await this.repository.addMember(guild.id, ownerId, 'LEADER', client);

      logger.info(`[Guilds:Create] Clã ${name} fundado por ${ownerId}`);
      return guild;
    });
  }

  /**
   * 🤝 ADICIONA MEMBRO À GUILDA
   */
  async joinGuild(userId, guildId) {
    const guild = await this.repository.findById(guildId);
    if (!guild) throw AppError.notFound('Guilda não localizada.');

    if (guild.member_count >= guild.max_members) {
      throw AppError.badRequest('Este clã já atingiu o limite máximo de membros.');
    }

    const alreadyInGuild = await this.repository.findByUserId(userId);
    if (alreadyInGuild) throw AppError.badRequest('Você já pertence a uma guilda.');

    try {
      const membership = await this.repository.addMember(guildId, userId, 'MEMBER');
      
      logger.info(`[Guilds:Join] Utilizador ${userId} entrou na guilda ${guildId}`);
      return membership;
    } catch (error) {
      logger.error(`[Guilds:Join:Fail] ${error.message}`);
      throw AppError.internal('Não foi possível processar sua entrada no clã.');
    }
  }

  /**
   * 🏃 SAÍDA OU EXPULSÃO DE MEMBRO
   */
  async leaveGuild(userId, guildId) {
    const membership = await this.repository.findByUserId(userId);
    
    if (!membership || membership.id !== guildId) {
      throw AppError.badRequest('Você não faz parte desta guilda.');
    }

    // Regra de Liderança: Líder não pode sair sem transferir ou dissolver
    if (membership.rank === 'LEADER') {
      throw AppError.forbidden('Um líder não pode abandonar o clã. Transfira a liderança ou dissolva a guilda.');
    }

    return await this.repository.removeMember(guildId, userId);
  }

  /**
   * 🔍 OBTÉM DETALHES COMPLETOS (VIEW 360º)
   */
  async getFullDetails(guildId) {
    const guild = await this.repository.findByIdWithDetails(guildId);
    if (!guild) throw AppError.notFound('Clã não encontrado.');

    const members = await this.repository.findMembers(guildId);

    return {
      ...guild,
      members
    };
  }

  /**
   * 📈 EVOLUÇÃO DA GUILDA (XP REWARD)
   * Adiciona experiência ao clã por atividades dos membros.
   */
  async awardGuildXP(guildId, amount) {
    if (amount <= 0) return;

    try {
      const result = await this.repository.addExperience(guildId, amount);
      
      // Lógica de Notificação de Level Up (Simples)
      if (result && result.level_up) {
         // Poderia disparar notificação para todos os membros aqui
         logger.info(`[Guilds:LevelUp] Clã ${guildId} subiu para o nível ${result.level}`);
      }

      return result;
    } catch (error) {
      logger.error(`[Guilds:XP] Falha ao premiar XP: ${error.message}`);
    }
  }

  /**
   * 🔨 MODERAÇÃO INTERNA: ALTERAR RANK
   */
  async changeMemberRank(adminId, guildId, targetUserId, newRank) {
    const adminMember = await this.repository.findByUserId(adminId);
    
    if (!adminMember || adminMember.id !== guildId || adminMember.rank !== 'LEADER') {
      throw AppError.forbidden('Apenas o líder do clã pode alterar patentes.');
    }

    if (newRank === 'LEADER') {
      throw AppError.badRequest('Para transferir a liderança, utilize a função de transferência específica.');
    }

    return await this.repository.updateMemberRank(guildId, targetUserId, newRank);
  }

  /**
   * 🗑️ DISSOLVER GUILDA (ADMIN/LEADER)
   */
  async disbandGuild(userId, guildId, isAdmin = false) {
    const guild = await this.repository.findById(guildId);
    if (!guild) throw AppError.notFound('Guilda não encontrada.');

    if (!isAdmin && guild.leader_id !== userId) {
      throw AppError.forbidden('Apenas o líder ou um administrador do sistema podem dissolver o clã.');
    }

    return await this.executeInTransaction(async (client) => {
      // 1. Remove todos os membros (limpa a tabela de junção)
      await client.query('DELETE FROM public.guild_members WHERE guild_id = $1', [guildId]);
      
      // 2. Remove a guilda
      const deleted = await this.repository.delete(guildId, client);
      
      logger.warn(`[Guilds:Disband] Clã ${guild.name} dissolvido por ${userId}`);
      return deleted;
    });
  }
}

module.exports = new GuildsService();