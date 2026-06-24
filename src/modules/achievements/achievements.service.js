/**
 * 🏆 OTAKU CLASH ANGOLA - ACHIEVEMENTS SERVICE
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Orquestrador de conquistas, verificação de requisitos e distribuição de prêmios.
 */

const BaseService = require('../../core/base/BaseService');
const achievementsRepository = require('./achievements.repository');
const walletsService = require('../wallets/wallets.service');
const notificationsService = require('../notifications/notifications.service');
const AppError = require('../../core/errors/AppError');
const logger = require('../../config/logger');

class AchievementsService extends BaseService {
  constructor() {
    super(achievementsRepository);
  }

  /**
   * 📑 LISTA CATÁLOGO COM STATUS DE PROGRESSO
   * @param {string} userId 
   */
  async listAllWithUserStatus(userId) {
    try {
      return await this.repository.findAllWithUserStatus(userId);
    } catch (error) {
      logger.error(`[AchievementsService:List] Erro: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🎯 VERIFICADOR DE GATILHOS (AUTO-CHECK)
   * Verifica se o utilizador atingiu metas para novas conquistas.
   * @param {string} userId 
   * @param {string} type - Tipo de requisito (ex: 'WIN_COUNT')
   * @param {number} currentValue - Valor atual atingido
   */
  async checkAndGrant(userId, type, currentValue) {
    try {
      // 1. Busca conquistas potenciais para este tipo de requisito
      const potentialAchievements = await this.repository.findByRequirementType(type);

      for (const achievement of potentialAchievements) {
        // 2. Verifica se o valor atual atende ao requisito técnico
        if (currentValue >= achievement.requirement_value) {
          
          // 3. Verifica se o utilizador já possui a conquista para evitar duplicidade
          const alreadyHas = await this.repository.hasAchievement(userId, achievement.id);
          
          if (!alreadyHas) {
            await this.grantAchievement(userId, achievement);
          }
        }
      }
    } catch (error) {
      // Erros em background tasks de conquistas não devem travar o fluxo principal do jogo
      logger.error(`[AchievementsService:Check] Falha silenciosa: ${error.message}`);
    }
  }

  /**
   * 🎖️ REALIZA O DESBLOQUEIO E PREMIAÇÃO (TRANSACTIONAL)
   */
  async grantAchievement(userId, achievement) {
    return await this.executeInTransaction(async (client) => {
      // 1. Registra o desbloqueio no banco
      const unlock = await this.repository.grantToUser(userId, achievement.id, client);
      
      if (!unlock) return false;

      // 2. Concede Recompensa de XP (via função RPC do banco para lidar com Level Up)
      if (achievement.reward_xp > 0) {
        await client.query('SELECT public.fn_add_user_xp($1, $2)', [userId, achievement.reward_xp]);
      }

      // 3. Concede Recompensa em Moedas (via WalletsService)
      if (parseFloat(achievement.reward_coins) > 0) {
        // Nota: O walletsService.credit já registra a transação financeira
        await walletsService.credit(
          userId, 
          parseFloat(achievement.reward_coins), 
          'ACHIEVEMENT_REWARD', 
          `Conquista Desbloqueada: ${achievement.name}`,
          { achievementId: achievement.id },
          client
        );
      }

      // 4. Dispara Notificação em Tempo Real (Background)
      notificationsService.notify({
        userId,
        title: '🏆 Nova Conquista!',
        message: `Parabéns! Desbloqueaste "${achievement.name}" e ganhaste recompensas.`,
        type: 'ACHIEVEMENT',
        metadata: { achievementId: achievement.id, badgeUrl: achievement.badge_url }
      }).catch(err => logger.warn(`[Achievements:Notify] Falha: ${err.message}`));

      logger.info(`[Achievements] Utilizador ${userId} conquistou: ${achievement.name}`);
      return true;
    });
  }

  /**
   * 📊 OBTÉM RESUMO DE PROGRESSO DO PLAYER
   */
  async getPlayerStats(userId) {
    try {
      const stats = await this.repository.getPlayerProgress(userId);
      const recent = await this.repository.findUserAchievements(userId);
      
      return {
        ...stats,
        recentAchievements: recent.slice(0, 3) // Top 3 mais recentes
      };
    } catch (error) {
      logger.error(`[AchievementsService:Stats] Erro: ${error.message}`);
      return { unlocked: 0, total: 0, percentage: 0, recentAchievements: [] };
    }
  }

  /**
   * 🛠️ GESTÃO ADMIN: CRIAR CONQUISTA
   */
  async createAchievement(data) {
    try {
      const achievement = await this.repository.create({
        ...data,
        name: data.name.trim(),
        requirement_value: parseInt(data.requirement_value),
        reward_xp: parseInt(data.reward_xp || 0),
        reward_coins: parseFloat(data.reward_coins || 0)
      });
      
      logger.info(`[Achievements:Admin] Nova conquista criada: ${achievement.name}`);
      return achievement;
    } catch (error) {
      logger.error(`[AchievementsService:Create] Falha: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new AchievementsService();