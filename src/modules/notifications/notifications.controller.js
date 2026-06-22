const BaseController = require('../../core/base/BaseController');
const notificationsService = require('./notifications.service');

/**
 * NotificationsController - Controlador para gestão de alertas e notificações do usuário.
 */
class NotificationsController extends BaseController {
  constructor() {
    super();
  }

  /**
   * Lista as notificações do usuário autenticado com paginação.
   * GET /api/v1/notifications
   */
  async list(req, res) {
    const userId = req.user.id;
    const { page, limit, unreadOnly } = req.query;

    const result = await notificationsService.getUserNotifications(userId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      unreadOnly: unreadOnly === 'true'
    });

    return this.paginate(res, result.items, result.pagination);
  }

  /**
   * Obtém o contador de notificações não lidas.
   * GET /api/v1/notifications/unread-count
   */
  async getUnreadCount(req, res) {
    const userId = req.user.id;
    const count = await notificationsService.getUnreadCount(userId);
    
    return this.success(res, { count }, 'Contagem de notificações não lidas recuperada.');
  }

  /**
   * Marca uma notificação específica como lida.
   * PATCH /api/v1/notifications/:id/read
   */
  async markRead(req, res) {
    const userId = req.user.id;
    const { id: notificationId } = req.params;

    const notification = await notificationsService.markAsRead(userId, notificationId);

    return this.success(res, notification, 'Notificação marcada como lida.');
  }

  /**
   * Marca todas as notificações do usuário como lidas.
   * POST /api/v1/notifications/read-all
   */
  async markAllRead(req, res) {
    const userId = req.user.id;
    
    await notificationsService.markAllAsRead(userId);

    return this.success(res, null, 'Todas as notificações foram marcadas como lidas.');
  }

  /**
   * Remove uma notificação do histórico.
   * DELETE /api/v1/notifications/:id
   */
  async delete(req, res) {
    const userId = req.user.id;
    const { id: notificationId } = req.params;

    const deleted = await notificationsService.repository.delete(notificationId);
    
    if (!deleted) {
      return res.status(404).json({ status: 'error', message: 'Notificação não encontrada.' });
    }

    return this.success(res, null, 'Notificação removida com sucesso.');
  }
}

module.exports = new NotificationsController();