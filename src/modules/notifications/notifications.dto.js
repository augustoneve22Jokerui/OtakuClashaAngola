/**
 * NotificationsDTO - Responsável pela transformação e formatação de dados de notificações.
 */
class NotificationsDTO {
  /**
   * Transforma uma única notificação para resposta da API.
   * @param {Object} notification - Registro bruto do banco de dados.
   */
  static transform(notification) {
    if (!notification) return null;

    let metadata = {};
    try {
      metadata = typeof notification.metadata === 'string' 
        ? JSON.parse(notification.metadata) 
        : notification.metadata || {};
    } catch (e) {
      metadata = {};
    }

    return {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type, // EX: 'MATCH_INVITE', 'WALLET_UPDATE', 'SYSTEM'
      isRead: !!notification.is_read,
      link: notification.link || null,
      metadata: metadata,
      createdAt: notification.created_at
    };
  }

  /**
   * Transforma uma lista de notificações.
   * @param {Array} notifications 
   */
  static transformMany(notifications) {
    if (!notifications || !Array.isArray(notifications)) return [];
    return notifications.map(item => this.transform(item));
  }

  /**
   * Formata o resumo de notificações para o cabeçalho do app.
   * @param {number} unreadCount 
   * @param {Array} recentNotifications 
   */
  static transformSummary(unreadCount, recentNotifications = []) {
    return {
      unreadCount: parseInt(unreadCount || 0),
      recent: this.transformMany(recentNotifications)
    };
  }
}

module.exports = NotificationsDTO;