const BaseRepository = require('../../core/base/BaseRepository');

/**
 * NotificationsRepository - Camada de acesso a dados para gestão de notificações.
 */
class NotificationsRepository extends BaseRepository {
  constructor() {
    super('public.notifications');
  }

  /**
   * Busca as notificações de um usuário com paginação e filtro opcional.
   * @param {string} userId - UUID do usuário.
   * @param {Object} options - { limit, offset, unreadOnly }
   */
  async findUserNotifications(userId, { limit = 20, offset = 0, unreadOnly = false }) {
    let query = `
      SELECT * FROM ${this.tableName}
      WHERE user_id = $1
    `;
    const params = [userId, limit, offset];

    if (unreadOnly) {
      query += ` AND is_read = false`;
    }

    query += ` ORDER BY created_at DESC LIMIT $2 OFFSET $3`;

    const { rows } = await this.db.query(query, params);
    return rows;
  }

  /**
   * Marca uma notificação específica como lida.
   * @param {string} notificationId 
   * @param {string} userId - Para garantir que o usuário só marque as próprias.
   */
  async markAsRead(notificationId, userId) {
    const query = `
      UPDATE ${this.tableName}
      SET is_read = true
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;
    const { rows } = await this.db.query(query, [notificationId, userId]);
    return rows[0] || null;
  }

  /**
   * Marca todas as notificações de um usuário como lidas.
   */
  async markAllAsRead(userId) {
    const query = `
      UPDATE ${this.tableName}
      SET is_read = true
      WHERE user_id = $1 AND is_read = false
      RETURNING id
    `;
    const { rows } = await this.db.query(query, [userId]);
    return rows;
  }

  /**
   * Conta o total de notificações não lidas de um usuário.
   */
  async countUnread(userId) {
    const query = `
      SELECT COUNT(*) as total 
      FROM ${this.tableName} 
      WHERE user_id = $1 AND is_read = false
    `;
    const { rows } = await this.db.query(query, [userId]);
    return parseInt(rows[0].total, 10);
  }

  /**
   * Remove notificações antigas (Manutenção de banco).
   * @param {number} days - Dias de retenção.
   */
  async deleteOldNotifications(days = 30) {
    const query = `
      DELETE FROM ${this.tableName}
      WHERE created_at < NOW() - INTERVAL '$1 days'
    `;
    const { rowCount } = await this.db.query(query, [days]);
    return rowCount;
  }
}

module.exports = new NotificationsRepository();