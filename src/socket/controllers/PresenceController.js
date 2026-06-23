/**
 * 👤 OTAKU CLASH ANGOLA - PRESENCE CONTROLLER
 * Versão: 2.0.0 - Enterprise Resilient
 * Descrição: Gerencia o estado de disponibilidade (Online/Offline) via WebSockets.
 */

const cacheProvider = require('../../config/hybridRedis');
const logger = require('../../config/logger');
const db = require('../../config/database');
const { socketConfig } = require('../../config/socket');

class PresenceController {
  /**
   * @param {import('socket.io').Server} io - Instância global do Socket.IO
   */
  constructor(io) {
    this.io = io;
    this.presenceKey = 'presence:online_users';
    this.setupEvents();
  }

  /**
   * Configura os listeners de conexão e desconexão no nível do servidor
   */
  setupEvents() {
    this.io.on('connection', async (socket) => {
      // socket.user é injetado pelo middleware de autenticação no SocketServer.js
      if (socket.user) {
        await this.handleUserOnline(socket);

        socket.on('disconnect', async (reason) => {
          await this.handleUserOffline(socket, reason);
        });
      }
    });
  }

  /**
   * 🟢 MARCA USUÁRIO COMO ONLINE
   * Adiciona ao cache distribuído e atualiza o banco de dados.
   */
  async handleUserOnline(socket) {
    const { id: userId, username } = socket.user;

    try {
      // 1. Adiciona ao Set de usuários online (Híbrido: Redis ou Memória)
      // sadd retorna 1 se for novo, 0 se já estiver no set
      const isNewConnection = await cacheProvider.client.sadd(this.presenceKey, userId);

      // 2. Se for a primeira conexão (não apenas um refresh ou nova aba)
      if (isNewConnection === 1) {
        logger.info(`[Presence] Usuário ${username} conectou-se ao ecossistema.`);

        // Notifica todos os namespaces sobre a entrada do usuário
        this.io.emit(socketConfig.events.USER_ONLINE || 'presence:online', {
          userId,
          username,
          timestamp: new Date().toISOString()
        });

        // 3. Atualiza persistência no PostgreSQL (Assíncrono)
        this.updatePresenceDB(userId, true);
      }

    } catch (error) {
      logger.error(`[Presence:Online] Erro ao processar entrada de ${userId}: ${error.message}`);
    }
  }

  /**
   * 🔴 MARCA USUÁRIO COMO OFFLINE
   * Verifica se todas as conexões do usuário foram encerradas.
   */
  async handleUserOffline(socket, reason) {
    const { id: userId, username } = socket.user;

    try {
      // 1. Recupera todos os sockets ativos do usuário no servidor (Cluster-aware via adapter)
      const userSockets = await this.io.in(`user:${userId}`).fetchSockets();

      // 2. Se não restarem sockets, o usuário está completamente desconectado
      if (userSockets.length === 0) {
        await cacheProvider.client.srem(this.presenceKey, userId);

        logger.info(`[Presence] Usuário ${username} está offline. Motivo: ${reason}`);

        // Notifica o sistema global
        this.io.emit(socketConfig.events.USER_OFFLINE || 'presence:offline', {
          userId,
          username,
          timestamp: new Date().toISOString()
        });

        // 3. Atualiza persistência no PostgreSQL
        this.updatePresenceDB(userId, false);
      } else {
        logger.debug(`[Presence] Usuário ${username} fechou uma aba, mas permanece conectado.`);
      }

    } catch (error) {
      logger.error(`[Presence:Offline] Erro ao processar saída de ${userId}: ${error.message}`);
    }
  }

  /**
   * 🛠️ ATUALIZAÇÃO DE BANCO DE DADOS (POSTGRESQL)
   */
  async updatePresenceDB(userId, isOnline) {
    const query = `
      UPDATE public.profiles 
      SET 
        is_online = $1, 
        last_seen = NOW(),
        updated_at = NOW()
      WHERE id = $2
    `;

    try {
      await db.query(query, [isOnline, userId]);
    } catch (error) {
      logger.error(`[Presence:DB] Falha ao atualizar last_seen para ${userId}: ${error.message}`);
    }
  }

  /**
   * 🔍 VERIFICA STATUS EM TEMPO REAL
   * Útil para Matchmaking e Chat
   */
  async isUserOnline(userId) {
    try {
      const result = await cacheProvider.client.sismember(this.presenceKey, userId);
      return result === 1;
    } catch (error) {
      return false;
    }
  }

  /**
   * 📋 LISTA TODOS OS USUÁRIOS ONLINE
   */
  async getOnlineUsers() {
    try {
      return await cacheProvider.client.smembers(this.presenceKey);
    } catch (error) {
      return [];
    }
  }
}

module.exports = PresenceController;