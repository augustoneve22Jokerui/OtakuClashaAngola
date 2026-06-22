const BaseController = require('../../core/base/BaseController');
const guildsService = require('./guilds.service');

/**
 * GuildsController - Controlador para gestão de clãs e organização social de jogadores.
 */
class GuildsController extends BaseController {
  constructor() {
    super();
  }

  /**
   * Lista todas as guildas com paginação e busca.
   * GET /api/v1/guilds
   */
  async list(req, res) {
    const { page, limit, search } = req.query;

    const filters = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      ...(search && { name: search }) // Busca por nome se fornecido
    };

    const items = await guildsService.repository.findAll({
      limit: filters.limit,
      offset: (filters.page - 1) * filters.limit,
      orderBy: 'level',
      order: 'DESC'
    });

    const total = await guildsService.repository.count(search ? { name: search } : {});

    return this.paginate(res, items, { total, page: filters.page, limit: filters.limit });
  }

  /**
   * Cria uma nova guilda (Consome saldo da Wallet).
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

    return this.created(res, guild, 'Guilda criada com sucesso! Sua jornada épica começa agora.');
  }

  /**
   * Obtém detalhes completos de uma guilda específica.
   * GET /api/v1/guilds/:id
   */
  async getDetails(req, res) {
    const { id } = req.params;
    const guild = await guildsService.getFullDetails(id);
    return this.success(res, guild);
  }

  /**
   * Obtém a guilda do usuário autenticado.
   * GET /api/v1/guilds/me
   */
  async getMyGuild(req, res) {
    const userId = req.user.id;
    const guild = await guildsService.repository.getUserGuild(userId);
    
    if (!guild) {
      return this.success(res, null, 'Você não pertence a nenhuma guilda no momento.');
    }

    const fullDetails = await guildsService.getFullDetails(guild.id);
    return this.success(res, fullDetails);
  }

  /**
   * Solicita entrada em uma guilda.
   * POST /api/v1/guilds/:id/join
   */
  async join(req, res) {
    const userId = req.user.id;
    const { id: guildId } = req.params;

    const result = await guildsService.joinGuild(userId, guildId);

    return this.success(res, result, 'Você agora é um membro desta guilda.');
  }

  /**
   * Sai da guilda atual.
   * POST /api/v1/guilds/:id/leave
   */
  async leave(req, res) {
    const userId = req.user.id;
    const { id: guildId } = req.params;

    await guildsService.leaveGuild(userId, guildId);

    return this.success(res, null, 'Você saiu da guilda com sucesso.');
  }

  /**
   * Atualiza o rank de um membro (Apenas Líder).
   * PATCH /api/v1/guilds/:id/members/:userId/rank
   */
  async updateMemberRank(req, res) {
    const adminId = req.user.id;
    const { id: guildId, userId: targetUserId } = req.params;
    const { rank } = req.body;

    const result = await guildsService.updateMemberRank(adminId, guildId, targetUserId, rank);

    return this.success(res, result, `Rank do membro atualizado para ${rank}.`);
  }

  /**
   * Remove (expulsa) um membro da guilda.
   * DELETE /api/v1/guilds/:id/members/:userId
   */
  async kickMember(req, res) {
    const adminId = req.user.id;
    const { id: guildId, userId: targetUserId } = req.params;

    // Lógica simplificada de permissão: apenas líder ou officer podem remover (conforme service)
    const adminStatus = await guildsService.repository.getUserGuild(adminId);
    if (!adminStatus || adminStatus.id !== guildId || (adminStatus.rank !== 'LEADER' && adminStatus.rank !== 'OFFICER')) {
      return res.status(403).json({ status: 'error', message: 'Você não tem permissão para remover membros.' });
    }

    await guildsService.repository.removeMember(guildId, targetUserId);

    return this.success(res, null, 'Membro removido da guilda.');
  }
}

module.exports = new GuildsController();