const BaseService = require('../../core/base/BaseService');
const achievementsRepository = require('./achievements.repository');
const AppError = require('../../core/errors/AppError');
const logger = require('../../config/logger');
const db = require('../../config/database');

/**
 * AchievementsService - Gerencia a lógica de negócios das conquistas e recompensas.
 */
class AchievementsService extends BaseService {
  constructor() {
    super(achievementsRepository);
  }

  /**
   * Lista todas as conquistas do sistema com o status de desbloqueio do usuário.
   * @param {string} userId 
   */
  async listAllWithUserStatus(userId) {
    try {
      const allAchievements = await this.repository.findAll({ limit: 100, orderBy: 'id', order: 'ASC' });
      const userUnlocked = await this.repository.findUserAchievements(userId);
      
      const unlockedIds = new Set(userUnlocked.map(ua => ua.id));

      return allAchievements.map(achievement => ({
        ...achievement,
        is_unlocked: unlockedIds.has(achievement.id),
        unlocked_at: userUnlocked.find(ua => ua.id === achievement.id)?.unlocked_at || null
      }));
    } catch (error) {
      logger.error(`[AchievementsService] Erro ao listar conquistas: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verifica se o usuário atingiu requisitos para novas conquistas e as concede.
   * @param {string} userId 
   * @param {string} requirementType - Tipo de ação (ex: 'WIN_COUNT', 'XP_LEVEL')
   * @param {number} currentValue - Valor atual atingido pelo usuário
   */
  async checkAndGrant(userId, requirementType, currentValue) {
    try {
      // 1. Busca conquistas potenciais para este tipo de requisito
      const potentialAchievements = await this.repository.findByRequirementType(requirementType);

      for (const achievement of potentialAchievements) {
        // 2. Verifica se o valor atual atende ao requisito
        if (currentValue >= achievement.requirement_value) {
          
          // 3. Verifica se o usuário já possui a conquista
          const alreadyHas = await this.repository.hasAchievement(userId, achievement.id);
          
          if (!alreadyHas) {
            await this.grantAchievement(userId, achievement);
          }
        }
      }
    } catch (error) {
      logger.error(`[AchievementsService] Falha na verificação de conquistas: ${error.message}`);
      // Erros em background tasks de conquistas não devem travar o fluxo principal do jogo
    }
  }

  /**
   * Realiza o processo de concessão de conquista e premiação.
   * @param {string} userId 
   * @param {Object} achievement 
   */
  async grantAchievement(userId, achievement) {
    return await this.executeInTransaction(async (client) => {
      // 1. Registra o desbloqueio
      await this.repository.grantToUser(userId, achievement.id, client);

      // 2. Concede Recompensa de XP (via função DB)
      if (achievement.reward_xp > 0) {
        await client.query('SELECT public.fn_add_user_xp($1, $2)', [userId, achievement.reward_xp]);
      }

      // 3. Concede Recompensa em Moedas (Wallet)
      if (achievement.reward_coins > 0) {
        const walletQuery = `
          UPDATE public.wallets 
          SET balance_available = balance_available + $1 
          WHERE user_id = $2 
          RETURNING id
        `;
        const { rows: [wallet] } = await client.query(walletQuery, [achievement.reward_coins, userId]);

        // Registrar transação financeira
        const transQuery = `
          INSERT INTO public.wallet_transactions (wallet_id, amount, direction, type, status, description)
          VALUES ($1, $2, 'CREDIT', 'ACHIEVEMENT_REWARD', 'COMPLETED', $3)
        `;
        await client.query(transQuery, [
          wallet.id, 
          achievement.reward_coins, 
          `Conquista desbloqueada: ${achievement.name}`
        ]);
      }

      logger.info(`[AchievementsService] Usuário ${userId} desbloqueou: ${achievement.name}`);
      
      // Aqui poderíamos disparar uma notificação via Socket.IO ou Push
      return true;
    });
  }

  /**
   * Obtém estatísticas de progresso do usuário.
   */
  async getUserStats(userId) {
    return await this.repository.getUserProgressStats(userId);
  }
}

module.exports = new AchievementsService();