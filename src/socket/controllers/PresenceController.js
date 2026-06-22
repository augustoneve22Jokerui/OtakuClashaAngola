const cacheProvider = require('../../config/cache');
const logger = require('../../config/logger');
const db = require('../../config/database');
const { socketConfig } = require('../../config/socket');

/**
 * PresenceController - Gerencia o estado de disponibilidade (Online/Offline) dos usuários.
 */
class PresenceController {
  /**
   * @param {import('socket.io').Server} io - Instância principal do Socket.IO
   */
  constructor(io) {
    this.io = io;
    this.presenceKey = 'presence:online_users';
    this.setupEvents();
  }

  /**
   * Configura os listeners globais de conexão para gerenciar presença.
   */
  setupEvents() {
    this.io.on('connection', async (socket) => {
      await this.handleUserOnline(socket);

      socket.on('disconnect', async () => {
        await this.handleUserOffline(socket);
      });
    });
  }

  /**
   * Marca o usuário como online e notifica o sistema.
   */
  async handleUserOnline(socket) {
    const userId = socket.user.id;
    const username = socket.user.username;

    try {
      // 1. Adiciona ao Set de usuários online no Redis
      // SADD retorna 1 se for um novo elemento, 0 se já existia
      const isNewConnection = await cacheProvider.client.sadd(this.presenceKey, userId);

      // 2. Se for a primeira conexão deste usuário (não apenas um refresh/nova aba)
      if (isNewConnection) {
        // Notifica amigos, clãs ou o sistema global
        this.io.emit(socketConfig.events.USER_ONLINE, {
          userId,
          username,
          timestamp: new Date().toISOString()
        });

        // 3. Atualiza o banco de dados (Assíncrono para não travar o socket)
        this.updateLastSeen(userId, true);
      }

      logger.debug(`[Presence] Usuário ${username} está ONLINE.`);
    } catch (error) {
      logger.error(`[Presence] Erro ao processar USER_ONLINE: ${error.message}`);
    }
  }

  /**
   * Marca o usuário como offline quando todas as suas conexões caem.
   */
  async handleUserOffline(socket) {
    const userId = socket.user.id;
    const username = socket.user.username;

    try {
      // 1. Verifica se o usuário ainda possui outras conexões ativas (abas abertas)
      const userSockets = await this.io.in(`user:${userId}`).fetchSockets();

      if (userSockets.length === 0) {
        // 2. Remove do Set do Redis
        await cacheProvider.client.srem(this.presenceKey, userId);

        // 3. Notifica a desconexão total
        this.io.emit(socketConfig.events.USER_OFFLINE, {
          userId,
          username,
          timestamp: new Date().toISOString()
        });

        // 4. Atualiza o banco de dados
        this.updateLastSeen(userId, false);

        logger.debug(`[Presence] Usuário ${username} está OFFLINE.`);
      }
    } catch (error) {
      logger.error(`[Presence] Erro ao processar USER_OFFLINE: ${error.message}`);
    }
  }

  /**
   * Atualiza a coluna de atividade no PostgreSQL.
   */
  async updateLastSeen(userId, isOnline) {
    try {
      const query = `
        UPDATE public.profiles 
        SET last_seen = NOW(), is_online = $2 
        WHERE id = $1
      `;
      await db.query(query, [userId, isOnline]);
    } catch (error) {
      logger.error(`[Presence] Falha ao atualizar last_seen no banco para ${userId}: ${error.message}`);
    }
  }

  /**
   * Retorna a lista de IDs de todos os usuários online no momento.
   */
  async getOnlineUsers() {
    return await cacheProvider.client.smembers(this.presenceKey);
  }

  /**
   * Verifica se um usuário específico está online.
   */
  async isUserOnline(userId) {
    return await cacheProvider.client.sismember(this.presenceKey, userId);
  }
}

module.exports = PresenceController;