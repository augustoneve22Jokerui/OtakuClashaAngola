const cacheProvider = require('../../config/cache');
const logger = require('../../config/logger');
const { socketConfig } = require('../../config/socket');

/**
 * LobbyController - Gerencia a lógica de salas de espera (Lobbies).
 */
class LobbyController {
  /**
   * @param {import('socket.io').Namespace} nsp - Namespace do Socket.IO (ex: /game)
   */
  constructor(nsp) {
    this.nsp = nsp;
    this.setupEvents();
  }

  /**
   * Configura os listeners de eventos para cada socket que se conecta ao namespace.
   */
  setupEvents() {
    this.nsp.on('connection', (socket) => {
      // Evento: Criar ou Entrar em uma Sala
      socket.on(socketConfig.events.JOIN_LOBBY, async (data) => {
        await this.handleJoinLobby(socket, data);
      });

      // Evento: Sair da Sala
      socket.on(socketConfig.events.LEAVE_LOBBY, async (data) => {
        await this.handleLeaveLobby(socket, data);
      });

      // Evento: Alternar status de "Pronto"
      socket.on('game:player_ready', async (data) => {
        await this.handleToggleReady(socket, data);
      });

      // Evento: Desconexão inesperada
      socket.on('disconnect', async () => {
        await this.handleDisconnect(socket);
      });
    });
  }

  /**
   * Processa a entrada de um jogador em uma sala.
   */
  async handleJoinLobby(socket, { roomId }) {
    try {
      const lobbyKey = `lobby:${roomId}`;
      let lobby = await cacheProvider.get(lobbyKey);

      if (!lobby) {
        // Se a sala não existe no cache, cria uma nova (exemplo simplificado de lógica de sala)
        lobby = {
          id: roomId,
          players: [],
          status: 'WAITING',
          createdAt: Date.now()
        };
      }

      // Verifica se o jogador já está na sala
      const playerExists = lobby.players.find(p => p.id === socket.user.id);
      
      if (!playerExists && lobby.players.length < 100) { // Limite genérico
        lobby.players.push({
          id: socket.user.id,
          username: socket.user.username,
          ready: false,
          joinedAt: Date.now()
        });
      }

      // Salva no cache e entra na sala do Socket.IO
      await cacheProvider.set(lobbyKey, lobby, 3600); // 1 hora de TTL
      socket.join(lobbyKey);
      socket.currentRoom = lobbyKey;

      // Notifica a todos na sala sobre o novo jogador
      this.nsp.to(lobbyKey).emit('game:lobby_updated', lobby);
      
      logger.info(`[LobbyController] Usuário ${socket.user.username} entrou na sala ${roomId}`);
    } catch (error) {
      logger.error(`[LobbyController] Erro ao entrar no lobby: ${error.message}`);
      socket.emit('game:error', { message: 'Não foi possível entrar na sala.' });
    }
  }

  /**
   * Processa a saída voluntária de um jogador.
   */
  async handleLeaveLobby(socket, { roomId }) {
    const lobbyKey = `lobby:${roomId}`;
    await this.removePlayerFromLobby(socket, lobbyKey);
  }

  /**
   * Gerencia a alteração do status "Ready" para início da partida.
   */
  async handleToggleReady(socket, { roomId, ready }) {
    const lobbyKey = `lobby:${roomId}`;
    let lobby = await cacheProvider.get(lobbyKey);

    if (lobby) {
      const playerIndex = lobby.players.findIndex(p => p.id === socket.user.id);
      if (playerIndex !== -1) {
        lobby.players[playerIndex].ready = ready;
        await cacheProvider.set(lobbyKey, lobby, 3600);
        this.nsp.to(lobbyKey).emit('game:lobby_updated', lobby);
      }
    }
  }

  /**
   * Remove o jogador do cache e da sala do Socket em caso de saída ou desconexão.
   */
  async removePlayerFromLobby(socket, lobbyKey) {
    try {
      let lobby = await cacheProvider.get(lobbyKey);

      if (lobby) {
        lobby.players = lobby.players.filter(p => p.id !== socket.user.id);

        if (lobby.players.length === 0) {
          await cacheProvider.del(lobbyKey);
        } else {
          await cacheProvider.set(lobbyKey, lobby, 3600);
          this.nsp.to(lobbyKey).emit('game:lobby_updated', lobby);
        }
      }

      socket.leave(lobbyKey);
      socket.currentRoom = null;
    } catch (error) {
      logger.error(`[LobbyController] Erro ao remover jogador do lobby: ${error.message}`);
    }
  }

  /**
   * Lógica para lidar com quedas de conexão.
   */
  async handleDisconnect(socket) {
    if (socket.currentRoom) {
      await this.removePlayerFromLobby(socket, socket.currentRoom);
    }
  }
}

module.exports = LobbyController;