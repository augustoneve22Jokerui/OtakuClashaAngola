const BaseController = require('../../core/base/BaseController');
const achievementsService = require('./achievements.service');

/**
 * AchievementsController - Controlador para gestão e consulta de conquistas.
 */
class AchievementsController extends BaseController {
  constructor() {
    super();
  }

  /**
   * Lista todas as conquistas disponíveis com o status do usuário autenticado.
   * GET /api/v1/achievements
   */
  async listMyAchievements(req, res) {
    const userId = req.user.id;
    
    const achievements = await achievementsService.listAllWithUserStatus(userId);
    
    return this.success(res, achievements, 'Conquistas recuperadas com sucesso.');
  }

  /**
   * Obtém estatísticas de progresso do usuário (Total desbloqueado vs Total disponível).
   * GET /api/v1/achievements/stats
   */
  async getMyStats(req, res) {
    const userId = req.user.id;
    
    const stats = await achievementsService.getUserStats(userId);
    
    return this.success(res, stats, 'Estatísticas de conquistas recuperadas.');
  }

  /**
   * Lista conquistas desbloqueadas por um usuário específico (Perfil Público).
   * GET /api/v1/achievements/user/:userId
   */
  async getByUserId(req, res) {
    const { userId } = req.params;
    
    // Busca apenas as que já foram desbloqueadas para exibição em perfil público
    const unlockedAchievements = await achievementsService.repository.findUserAchievements(userId);
    
    return this.success(res, unlockedAchievements, 'Conquistas do usuário recuperadas.');
  }

  /**
   * Obtém detalhes de uma conquista específica.
   * GET /api/v1/achievements/:id
   */
  async getById(req, res) {
    const { id } = req.params;
    
    const achievement = await achievementsService.findById(id);
    
    return this.success(res, achievement);
  }
}

module.exports = new AchievementsController();