/**
 * 👤 OTAKU CLASH ANGOLA - PROFILES CONTROLLER
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Gerencia requisições de perfis, identidades sociais e estatísticas.
 */

const BaseController = require('../../core/base/BaseController');
const profilesService = require('./profiles.service');

class ProfilesController extends BaseController {
  constructor() {
    super();
  }

  /**
   * 🏠 OBTÉM DADOS DO PRÓPRIO PERFIL
   * GET /api/v1/profiles/me
   */
  async getMe(req, res) {
    // req.user é injetado pelo authMiddleware
    const userId = req.user.id;
    
    const profile = await profilesService.getMyProfile(userId);
    
    return this.success(res, profile, 'Seu perfil foi recuperado com sucesso.');
  }

  /**
   * 🌍 OBTÉM DADOS DE PERFIL PÚBLICO
   * GET /api/v1/profiles/:identifier
   * identifier pode ser o UUID ou o Username.
   */
  async getPublic(req, res) {
    const { identifier } = req.params;
    
    const profile = await profilesService.getPublicProfile(identifier);
    
    return this.success(res, profile, 'Dados públicos do perfil recuperados.');
  }

  /**
   * ✍️ ATUALIZA PERFIL (INCLUINDO AVATAR)
   * PATCH /api/v1/profiles/me
   */
  async update(req, res) {
    const userId = req.user.id;
    
    // Dados textuais do body
    const updateData = {
      username: req.body.username,
      full_name: req.body.full_name
    };
    
    // Ficheiro de imagem interceptado pelo multer na rota
    const avatarFile = req.file;

    const updatedProfile = await profilesService.updateProfile(userId, updateData, avatarFile);

    return this.success(res, updatedProfile, 'Perfil actualizado com sucesso.');
  }

  /**
   * 🔎 BUSCA DE UTILIZADORES (DESCOBERTA)
   * GET /api/v1/profiles/search
   */
  async search(req, res) {
    const { q, limit } = req.query;
    
    const results = await profilesService.searchUsers(q, parseInt(limit) || 10);
    
    return this.success(res, results, `Busca concluída para "${q}".`);
  }

  /**
   * 🏆 ESTATÍSTICAS COMPETITIVAS DO UTILIZADOR
   * GET /api/v1/profiles/me/stats
   */
  async getMyStats(req, res) {
    const userId = req.user.id;
    
    const stats = await profilesService.repository.getProfileStats(userId);
    
    return this.success(res, stats, 'Suas estatísticas de jogo foram recuperadas.');
  }
}

module.exports = new ProfilesController();