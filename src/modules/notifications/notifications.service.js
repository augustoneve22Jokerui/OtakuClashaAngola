const BaseService = require('../../core/base/BaseService');
const notificationsRepository = require('./notifications.repository');
const socketServer = require('../../socket/SocketServer');
const pushNotificationService = require('../../services/notification/PushNotificationService');
const logger = require('../../config/logger');
const AppError = require('../../core/errors/AppError');

/**
 * NotificationsService - Gerencia alertas, mensagens de sistema e notificações push.
 */
class NotificationsService extends BaseService {
  constructor() {
    super(notificationsRepository);
  }

  /**
   * Obtém as notificações do usuário com paginação e filtro.
   */
  async getUserNotifications(userId, filters = {}) {
    try {
      const { page = 1, limit = 20, unreadOnly = false } = filters;
      const offset = (page - 1) * limit;

      const items = await this.repository.findUserNotifications(userId, {
        limit,
        offset,
        unreadOnly
      });

      const unreadCount = await this.repository.countUnread(userId);

      return {
        items,
        unreadCount,
        pagination: {
          total: await this.repository.count({ user_id: userId }),
          page,
          limit
        }
      };
    } catch (error) {
      logger.error(`[NotificationsService] Erro ao buscar notificações: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cria e envia uma nova notificação em múltiplos canais.
   * @param {Object} data - { userId, title, message, type, link, metadata }
   */
  async notify(data) {
    const { userId, title, message, type, link, metadata = {} } = data;

    try {
      // 1. Persistência no Banco de Dados (Histórico)
      const notification = await this.repository.create({
        user_id: userId,
        title,
        message,
        type,
        link,
        metadata: JSON.stringify(metadata),
        is_read: false
      });

      // 2. Envio via Socket.IO (Tempo Real se conectado)
      socketServer.emitToUser(userId, 'notification:received', {
        id: notification.id,
        title,
        message,
        type,
        link,
        createdAt: notification.created_at
      });

      // 3. Envio via Push Notification (Dispositivo Móvel)
      pushNotificationService.sendToUser(userId, {
        title,
        body: message,
        data: {
          type,
          link: link || '',
          notificationId: notification.id
        }
      }).catch(err => logger.warn(`[NotificationsService] Falha no Push: ${err.message}`));

      return notification;
    } catch (error) {
      logger.error(`[NotificationsService] Erro ao processar notificação: ${error.message}`);
      // Não lançamos erro para não interromper o processo principal que gerou a notificação
      return null;
    }
  }

  /**
   * Marca uma notificação como lida.
   */
  async markAsRead(userId, notificationId) {
    const notification = await this.repository.markAsRead(notificationId, userId);
    if (!notification) {
      throw AppError.notFound('Notificação não encontrada.');
    }
    return notification;
  }

  /**
   * Marca todas as notificações do usuário como lidas.
   */
  async markAllAsRead(userId) {
    return await this.repository.markAllAsRead(userId);
  }

  /**
   * Obtém apenas a contagem de mensagens não lidas.
   */
  async getUnreadCount(userId) {
    return await this.repository.countUnread(userId);
  }
}

module.exports = new NotificationsService();