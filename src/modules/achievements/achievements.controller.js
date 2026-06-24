/**
 * 🏆 OTAKU CLASH ANGOLA - ACHIEVEMENTS CONTROLLER
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Gerencia as requisições de catálogo de conquistas, progresso e curadoria.
 */

const BaseController = require('../../core/base/BaseController');
const achievementsService = require('./achievements.service');

class AchievementsController extends BaseController {
  constructor() {
    super();
  }

  /**
   * 📑 LISTAR TODAS AS CONQUISTAS (PLAYER VIEW)
   * Retorna o catálogo completo com o status de desbloqueio do utilizador logado.
   * GET /api/v1/achievements
   */
  async listMyAchievements(req, res) {
    const userId = req.user.id;
    
    const achievements = await achievementsService.listAllWithUserStatus(userId);
    
    return this.success(res, achievements, 'Catálogo de conquistas sincronizado.');
  }

  /**
   * 📊 OBTER ESTATÍSTICAS DE PROGRESSO (PLAYER)
   * Retorna contagem de desbloqueios e conquistas recentes.
   * GET /api/v1/achievements/stats
   */
  async getMyStats(req, res) {
    const userId = req.user.id;
    
    const stats = await achievementsService.getPlayerStats(userId);
    
    return this.success(res, stats, 'Estatísticas de progresso recuperadas.');
  }

  /**
   * 🔍 CONSULTAR CONQUISTAS DE OUTRO UTILIZADOR (PÚBLICO)
   * GET /api/v1/achievements/user/:userId
   */
  async getByUserId(req, res) {
    const { userId } = req.params;
    
    const unlockedAchievements = await achievementsService.repository.findUserAchievements(userId);
    
    return this.success(res, unlockedAchievements, 'Conquistas do utilizador recuperadas.');
  }

  /**
   * 🆔 OBTER DETALHES DE UMA CONQUISTA
   * GET /api/v1/achievements/:id
   */
  async getById(req, res) {
    const { id } = req.params;
    
    const achievement = await achievementsService.findById(id);
    
    return this.success(res, achievement);
  }

  /**
   * ✨ CRIAR NOVA CONQUISTA (ADMIN ONLY)
   * POST /api/v1/achievements
   */
  async create(req, res) {
    const achievementData = {
      name: req.body.name,
      description: req.body.description,
      category: req.body.category,
      requirement_type: req.body.requirement_type,
      requirement_value: parseInt(req.body.requirement_value),
      reward_xp: parseInt(req.body.reward_xp || 0),
      reward_coins: parseFloat(req.body.reward_coins || 0),
      badge_url: req.body.badge_url
    };

    const newAchievement = await achievementsService.createAchievement(achievementData);

    return this.created(res, newAchievement, 'Nova conquista publicada no ecossistema.');
  }

  /**
   * ✍️ ATUALIZAR CONQUISTA (ADMIN ONLY)
   * PATCH /api/v1/achievements/:id
   */
  async update(req, res) {
    const { id } = req.params;
    const updateData = req.body;

    // Garante conversão de tipos numéricos
    if (updateData.requirement_value) updateData.requirement_value = parseInt(updateData.requirement_value);
    if (updateData.reward_xp) updateData.reward_xp = parseInt(updateData.reward_xp);
    if (updateData.reward_coins) updateData.reward_coins = parseFloat(updateData.reward_coins);

    const updated = await achievementsService.update(id, updateData);

    return this.success(res, updated, 'Registo da conquista actualizado.');
  }

  /**
   * 🗑️ REMOVER CONQUISTA (ADMIN ONLY)
   * DELETE /api/v1/achievements/:id
   */
  async delete(req, res) {
    const { id } = req.params;

    const deleted = await achievementsService.delete(id);

    if (!deleted) {
      const AppError = require('../../core/errors/AppError');
      throw AppError.notFound('Conquista não encontrada ou já removida.');
    }

    return this.noContent(res);
  }
}

module.exports = new AchievementsController();