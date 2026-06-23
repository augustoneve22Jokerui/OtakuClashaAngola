const axios = require('axios');
const db = require('../../config/database');
const logger = require('../../config/logger');
const env = require('../../config/env');

/**
 * PushNotificationService - Gerencia o envio de notificações push via FCM.
 * Utilizado para alertas de tempo real, marketing e eventos de jogo.
 */
class PushNotificationService {
  constructor() {
    this.fcmUrl = 'https://fcm.googleapis.com/fcm/send';
    this.serverKey = process.env.FCM_SERVER_KEY; // Deve ser configurado no .env
  }

  /**
   * Envia uma notificação para um usuário específico buscando seus tokens no banco.
   * @param {string} userId - UUID do usuário.
   * @param {Object} payload - { title, body, data }
   */
  async sendToUser(userId, { title, body, data = {} }) {
    try {
      // Busca todos os tokens ativos vinculados ao perfil do usuário
      const query = `SELECT fcm_token FROM public.user_devices WHERE user_id = $1 AND is_active = true`;
      const { rows } = await db.query(query, [userId]);

      if (rows.length === 0) {
        logger.debug(`[PushService] Usuário ${userId} não possui tokens de push registrados.`);
        return false;
      }

      const tokens = rows.map(r => r.fcm_token);
      return await this.sendMulticast(tokens, { title, body, data });
    } catch (error) {
      logger.error(`[PushService] Erro ao enviar para usuário ${userId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Envia uma notificação para múltiplos tokens (Multicast).
   * @param {string[]} tokens - Array de FCM Tokens.
   * @param {Object} notification - { title, body, data }
   */
  async sendMulticast(tokens, { title, body, data = {} }) {
    if (!this.serverKey) {
      logger.warn('[PushService] FCM_SERVER_KEY não configurado. Notificação push ignorada.');
      return false;
    }

    try {
      const response = await axios.post(
        this.fcmUrl,
        {
          registration_ids: tokens,
          notification: {
            title,
            body,
            sound: 'default',
            badge: 1
          },
          data: {
            ...data,
            click_action: 'FLUTTER_NOTIFICATION_CLICK' // Padrão para apps móveis
          },
          priority: 'high'
        },
        {
          headers: {
            'Authorization': `key=${this.serverKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Lógica para limpar tokens inválidos (expirados pelo Google/Apple)
      if (response.data.failure > 0) {
        this.cleanupInvalidTokens(tokens, response.data.results);
      }

      logger.info(`[PushService] Notificação enviada. Sucessos: ${response.data.success}, Falhas: ${response.data.failure}`);
      return response.data;
    } catch (error) {
      logger.error(`[PushService] Erro na requisição FCM: ${error.message}`);
      return false;
    }
  }

  /**
   * Envia uma notificação para um tópico (ex: 'all_users', 'battle_royale').
   */
  async sendToTopic(topic, { title, body, data = {} }) {
    try {
      await axios.post(
        this.fcmUrl,
        {
          to: `/topics/${topic}`,
          notification: { title, body },
          data,
          priority: 'high'
        },
        {
          headers: {
            'Authorization': `key=${this.serverKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return true;
    } catch (error) {
      logger.error(`[PushService] Erro ao enviar para tópico ${topic}: ${error.message}`);
      return false;
    }
  }

  /**
   * Remove tokens do banco de dados que foram rejeitados pelo servidor de push.
   */
  async cleanupInvalidTokens(tokens, results) {
    const invalidTokens = [];

    results.forEach((result, index) => {
      if (result.error === 'NotRegistered' || result.error === 'InvalidRegistration') {
        invalidTokens.push(tokens[index]);
      }
    });

    if (invalidTokens.length > 0) {
      const query = `UPDATE public.user_devices SET is_active = false WHERE fcm_token = ANY($1)`;
      await db.query(query, [invalidTokens]);
      logger.info(`[PushService] Cleaned up ${invalidTokens.length} invalid tokens.`);
    }
  }
}

module.exports = new PushNotificationService();