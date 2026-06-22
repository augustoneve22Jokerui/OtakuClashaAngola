const BaseController = require('../../core/base/BaseController');
const profilesService = require('./profiles.service');

/**
 * ProfilesController - Controlador para gestão de perfis, estatísticas e identidade social.
 */
class ProfilesController extends BaseController {
  constructor() {
    super();
  }

  /**
   * Obtém os dados do perfil do usuário autenticado.
   * GET /api/v1/profiles/me
   */
  async getMe(req, res) {
    const userId = req.user.id;
    const profile = await profilesService.getMyProfile(userId);
    
    return this.success(res, profile, 'Seu perfil foi recuperado com sucesso.');
  }

  /**
   * Obtém os dados públicos de um perfil de usuário por ID ou Username.
   * GET /api/v1/profiles/:identifier
   */
  async getPublic(req, res) {
    const { identifier } = req.params;
    
    // Tenta buscar por ID (UUID) ou por Username
    let profile;
    const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[4][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(identifier);

    if (isUUID) {
      profile = await profilesService.getPublicProfile(identifier);
    } else {
      const user = await profilesService.repository.findOneByField('username', identifier);
      if (!user) {
        return res.status(404).json({ status: 'error', message: 'Usuário não encontrado.' });
      }
      profile = await profilesService.getPublicProfile(user.id);
    }

    return this.success(res, profile, 'Dados públicos do perfil recuperados.');
  }

  /**
   * Atualiza os dados do perfil (incluindo upload de avatar).
   * PATCH /api/v1/profiles/me
   */
  async update(req, res) {
    const userId = req.user.id;
    const updateData = {
      username: req.body.username,
      full_name: req.body.full_name
    };
    
    // O arquivo vem através do middleware multer na rota
    const avatarFile = req.file;

    const updatedProfile = await profilesService.updateProfile(userId, updateData, avatarFile);

    return this.success(res, updatedProfile, 'Perfil atualizado com sucesso.');
  }

  /**
   * Busca usuários pelo nome (para sistema de amigos ou ranking).
   * GET /api/v1/profiles/search
   */
  async search(req, res) {
    const { q, limit } = req.query;
    
    const results = await profilesService.searchUsers(q);
    
    return this.success(res, results, `Busca concluída para "${q}".`);
  }

  /**
   * Obtém apenas as estatísticas competitivas do usuário.
   * GET /api/v1/profiles/me/stats
   */
  async getMyStats(req, res) {
    const userId = req.user.id;
    const stats = await profilesService.repository.getProfileStats(userId);
    
    return this.success(res, stats, 'Estatísticas de jogo recuperadas.');
  }
}

module.exports = new ProfilesController();