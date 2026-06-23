/**
 * 🎮 OTAKU CLASH ANGOLA - LOBBY CONTROLLER
 * Versão: 2.0.0 - Enterprise Resilient
 * Descrição: Gerencia salas de espera, estados de prontidão e sincronização de pré-jogo.
 */

const cacheProvider = require('../../config/hybridRedis');
const logger = require('../../config/logger');
const { socketConfig } = require('../../config/socket');

class LobbyController {
  /**
   * @param {import('socket.io').Namespace} nsp - Namespace /game
   */
  constructor(nsp) {
    this.nsp = nsp;
    this.lobbyPrefix = 'game:lobby:';
    this.setupEvents();
  }

  /**
   * Configura listeners para interações no lobby
   */
  setupEvents() {
    this.nsp.on('connection', (socket) => {
      // 1. Ingressar em um Lobby
      socket.on(socketConfig.events.JOIN_LOBBY || 'game:join_lobby', async (data) => {
        await this.handleJoinLobby(socket, data);
      });

      // 2. Sair do Lobby
      socket.on(socketConfig.events.LEAVE_LOBBY || 'game:leave_lobby', async (data) => {
        await this.handleLeaveLobby(socket, data);
      });

      // 3. Alternar Status de Pronto (Ready Check)
      socket.on('game:player_ready', async (data) => {
        await this.handleToggleReady(socket, data);
      });

      // 4. Limpeza automática em desconexão
      socket.on('disconnect', async (reason) => {
        await this.handleAutoCleanup(socket, reason);
      });
    });
  }

  /**
   * 🚪 ENTRADA NO LOBBY
   * @param {Object} data - { roomId }
   */
  async handleJoinLobby(socket, { roomId }) {
    if (!roomId) return;

    const lobbyKey = `${this.lobbyPrefix}${roomId}`;
    
    try {
      // 1. Recupera estado atual do lobby do cache (Híbrido)
      const cachedData = await cacheProvider.client.get(lobbyKey);
      let lobby = cachedData ? JSON.parse(cachedData) : {
        id: roomId,
        players: [],
        status: 'WAITING',
        createdAt: Date.now()
      };

      // 2. Verifica se o jogador já está no lobby
      const playerIndex = lobby.players.findIndex(p => p.id === socket.user.id);
      
      if (playerIndex === -1) {
        lobby.players.push({
          id: socket.user.id,
          username: socket.user.username,
          avatarUrl: socket.user.avatarUrl || null,
          level: socket.user.level || 1,
          isReady: false,
          socketId: socket.id,
          joinedAt: Date.now()
        });
      } else {
        // Atualiza o socketId caso o utilizador tenha reconectado
        lobby.players[playerIndex].socketId = socket.id;
      }

      // 3. Salva no cache com TTL de 1 hora
      await cacheProvider.client.set(lobbyKey, JSON.stringify(lobby), 'EX', 3600);

      // 4. Ingressa na sala física do Socket.IO
      socket.join(lobbyKey);
      socket.currentLobby = lobbyKey;

      // 5. Notifica todos na sala
      this.nsp.to(lobbyKey).emit(socketConfig.events.LOBBY_UPDATED || 'game:lobby_updated', lobby);
      
      logger.info(`[Lobby] ${socket.user.username} entrou na sala ${roomId}`);

    } catch (error) {
      logger.error(`[Lobby:Join] Erro: ${error.message}`);
      socket.emit('game:error', { message: 'Falha ao processar entrada na sala de espera.' });
    }
  }

  /**
   * ✅ ALTERNAR STATUS "PRONTO"
   */
  async handleToggleReady(socket, { roomId, isReady }) {
    const lobbyKey = `${this.lobbyPrefix}${roomId}`;
    
    try {
      const cachedData = await cacheProvider.client.get(lobbyKey);
      if (!cachedData) return;

      const lobby = JSON.parse(cachedData);
      const player = lobby.players.find(p => p.id === socket.user.id);

      if (player) {
        player.isReady = isReady;
        await cacheProvider.client.set(lobbyKey, JSON.stringify(lobby), 'EX', 3600);
        
        // Sincroniza estado com a sala
        this.nsp.to(lobbyKey).emit(socketConfig.events.LOBBY_UPDATED || 'game:lobby_updated', lobby);
      }
    } catch (error) {
      logger.error(`[Lobby:Ready] Erro: ${error.message}`);
    }
  }

  /**
   * 🏃 SAÍDA VOLUNTÁRIA DO LOBBY
   */
  async handleLeaveLobby(socket, { roomId }) {
    const lobbyKey = `${this.lobbyPrefix}${roomId}`;
    await this._removePlayerFromLobby(socket, lobbyKey);
  }

  /**
   * 🧹 LIMPEZA AUTOMÁTICA (PRIVATE)
   */
  async _removePlayerFromLobby(socket, lobbyKey) {
    try {
      const cachedData = await cacheProvider.client.get(lobbyKey);
      if (!cachedData) return;

      let lobby = JSON.parse(cachedData);
      lobby.players = lobby.players.filter(p => p.id !== socket.user.id);

      if (lobby.players.length === 0) {
        // Se a sala ficou vazia, remove do cache
        await cacheProvider.client.del(lobbyKey);
        logger.debug(`[Lobby] Sala ${lobbyKey} encerrada por inatividade.`);
      } else {
        // Se ainda há jogadores, atualiza o cache e notifica
        await cacheProvider.client.set(lobbyKey, JSON.stringify(lobby), 'EX', 3600);
        this.nsp.to(lobbyKey).emit(socketConfig.events.LOBBY_UPDATED || 'game:lobby_updated', lobby);
      }

      socket.leave(lobbyKey);
      socket.currentLobby = null;
      logger.info(`[Lobby] ${socket.user.username} abandonou a sala.`);

    } catch (error) {
      logger.error(`[Lobby:Cleanup] Erro: ${error.message}`);
    }
  }

  /**
   * ⚡ HANDLER DE DESCONEXÃO INESPERADA
   */
  async handleAutoCleanup(socket, reason) {
    if (socket.currentLobby) {
      logger.warn(`[Lobby] Desconexão detectada (${reason}). Removendo ${socket.user.username} da sala.`);
      await this._removePlayerFromLobby(socket, socket.currentLobby);
    }
  }
}

module.exports = LobbyController;