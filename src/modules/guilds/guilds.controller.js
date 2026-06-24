/**
 * 🛡️ OTAKU CLASH ANGOLA - GUILDS CONTROLLER
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Gerencia requisições para clãs, membros, progressão social e moderação.
 */

const BaseController = require('../../core/base/BaseController');
const guildsService = require('./guilds.service');

class GuildsController extends BaseController {
  constructor() {
    super();
  }

  /**
   * 📑 LISTAGEM DE GUILDAS (DIRECTÓRIO)
   * GET /api/v1/guilds
   */
  async list(req, res) {
    const { page, limit, search } = req.query;

    const filters = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      search: search || null
    };

    // Busca no repositório com paginação padrão
    const items = await guildsService.repository.findAll({
      limit: filters.limit,
      offset: (filters.page - 1) * filters.limit,
      orderBy: 'level',
      order: 'DESC'
    });

    const total = await guildsService.repository.count(
        filters.search ? { name: filters.search } : {}
    );

    return this.paginate(res, items, { 
        total, 
        page: filters.page, 
        limit: filters.limit 
    });
  }

  /**
   * 🏗️ FUNDAR NOVO CLÃ (PLAYER ACTION)
   * Realiza a cobrança em AKZ e cria o vínculo de líder.
   * POST /api/v1/guilds
   */
  async create(req, res) {
    const ownerId = req.user.id;
    const guildData = {
      name: req.body.name,
      tag: req.body.tag,
      description: req.body.description,
      logo_url: req.body.logo_url
    };

    const guild = await guildsService.createGuild(ownerId, guildData);

    return this.created(res, guild, 'Clã fundado com sucesso! A tua jornada épica começa agora.');
  }

  /**
   * 🔍 DETALHES COMPLETOS DE UM CLÃ
   * GET /api/v1/guilds/:id
   */
  async getDetails(req, res) {
    const { id } = req.params;
    
    const guildDetails = await guildsService.getFullDetails(id);
    
    return this.success(res, guildDetails, 'Ficha técnica do clã recuperada.');
  }

  /**
   * 🆔 OBTER MINHA GUILDA
   * GET /api/v1/guilds/me
   */
  async getMyGuild(req, res) {
    const userId = req.user.id;
    
    const membership = await guildsService.repository.findByUserId(userId);
    
    if (!membership) {
      return this.success(res, null, 'Atualmente você não pertence a nenhuma guilda.');
    }

    const fullDetails = await guildsService.getFullDetails(membership.id);
    return this.success(res, fullDetails);
  }

  /**
   * 🤝 ENTRAR EM UM CLÃ
   * POST /api/v1/guilds/:id/join
   */
  async join(req, res) {
    const userId = req.user.id;
    const { id: guildId } = req.params;

    const membership = await guildsService.joinGuild(userId, guildId);

    return this.success(res, membership, 'Agora és um membro oficial deste clã.');
  }

  /**
   * 🏃 SAIR DO CLÃ
   * POST /api/v1/guilds/:id/leave
   */
  async leave(req, res) {
    const userId = req.user.id;
    const { id: guildId } = req.params;

    await guildsService.leaveGuild(userId, guildId);

    return this.success(res, null, 'Saíste do clã com sucesso.');
  }

  /**
   * 🔨 ATUALIZAR PATENTE DE MEMBRO (LIDERANÇA)
   * PATCH /api/v1/guilds/:id/members/:userId/rank
   */
  async updateMemberRank(req, res) {
    const adminId = req.user.id;
    const { id: guildId, userId: targetUserId } = req.params;
    const { rank } = req.body;

    const result = await guildsService.changeMemberRank(
        adminId, 
        guildId, 
        targetUserId, 
        rank
    );

    return this.success(res, result, `Patente do membro alterada para ${rank}.`);
  }

  /**
   * 🗑️ DISSOLVER CLÃ (ADMIN/LEADER)
   * DELETE /api/v1/guilds/:id
   */
  async disband(req, res) {
    const userId = req.user.id;
    const { id: guildId } = req.params;
    const isAdmin = req.user.role === 'ADMIN';

    await guildsService.disbandGuild(userId, guildId, isAdmin);

    return this.noContent(res);
  }

  /**
   * 🚫 EXPULSAR MEMBRO
   * DELETE /api/v1/guilds/:id/members/:userId
   */
  async kickMember(req, res) {
    const adminId = req.user.id;
    const { id: guildId, userId: targetUserId } = req.params;

    const adminMember = await guildsService.repository.findByUserId(adminId);
    if (!adminMember || adminMember.id !== guildId || !['LEADER', 'OFFICER'].includes(adminMember.rank)) {
      const AppError = require('../../core/errors/AppError');
      throw AppError.forbidden('Não tens permissão para expulsar membros.');
    }

    await guildsService.repository.removeMember(guildId, targetUserId);

    return this.success(res, null, 'O membro foi removido do clã.');
  }
}

module.exports = new GuildsController();