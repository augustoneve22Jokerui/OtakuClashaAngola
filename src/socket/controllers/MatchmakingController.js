const cacheProvider = require('../../config/cache');
const logger = require('../../config/logger');
const { socketConfig } = require('../../config/socket');
const { MatchTypes } = require('../../core/constants/MatchTypes');
const { v4: uuidv4 } = require('uuid');

/**
 * MatchmakingController - Gerencia a lógica de busca de oponentes em tempo real.
 */
class MatchmakingController {
  /**
   * @param {import('socket.io').Namespace} nsp - Namespace do Socket.IO (ex: /game)
   */
  constructor(nsp) {
    this.nsp = nsp;
    this.queueKeyPrefix = 'matchmaking:queue:';
    this.setupEvents();
  }

  /**
   * Configura os listeners de eventos de matchmaking.
   */
  setupEvents() {
    this.nsp.on('connection', (socket) => {
      // Iniciar busca por partida
      socket.on('match:find', async (data) => {
        await this.handleFindMatch(socket, data);
      });

      // Cancelar busca
      socket.on('match:cancel', async () => {
        await this.handleCancelSearch(socket);
      });

      // Limpeza em caso de desconexão durante a busca
      socket.on('disconnect', async () => {
        await this.handleCancelSearch(socket);
      });
    });
  }

  /**
   * Adiciona o jogador à fila e tenta encontrar um par.
   * @param {Object} data - { entryFee, animeId }
   */
  async handleFindMatch(socket, { entryFee = 0, animeId = null }) {
    try {
      const playerInfo = {
        socketId: socket.id,
        userId: socket.user.id,
        username: socket.user.username,
        level: socket.user.level || 1,
        entryFee,
        animeId,
        joinedAt: Date.now()
      };

      // Define a chave da fila baseada no valor da aposta (segmentação básica)
      const queueKey = `${this.queueKeyPrefix}${entryFee}:${animeId || 'any'}`;

      // 1. Tenta pegar o primeiro oponente disponível na fila (FIFO)
      const opponentDataString = await cacheProvider.client.lpop(queueKey);

      if (opponentDataString) {
        const opponent = JSON.parse(opponentDataString);

        // Verifica se o oponente ainda está online
        const opponentSocket = this.nsp.sockets.get(opponent.socketId);

        if (opponentSocket && opponent.userId !== playerInfo.userId) {
          // PAR ENCONTRADO!
          await this.createMatch(socket, opponentSocket, { entryFee, animeId });
        } else {
          // Oponente offline ou é o próprio usuário, tenta novamente ou entra na fila
          await this.handleFindMatch(socket, { entryFee, animeId });
        }
      } else {
        // 2. Ninguém na fila, adiciona este jogador para esperar
        await cacheProvider.client.rpush(queueKey, JSON.stringify(playerInfo));
        // TTL de 2 minutos para evitar filas fantasmas
        await cacheProvider.client.expire(queueKey, 120);
        
        socket.currentMatchQueue = queueKey;
        socket.emit('match:searching', { status: 'waiting_for_opponent' });
        
        logger.info(`[Matchmaking] Usuário ${socket.user.username} entrou na fila: ${queueKey}`);
      }
    } catch (error) {
      logger.error(`[Matchmaking] Erro ao buscar partida: ${error.message}`);
      socket.emit('match:error', { message: 'Erro ao iniciar matchmaking.' });
    }
  }

  /**
   * Cria a estrutura da partida e notifica ambos os jogadores.
   */
  async createMatch(player1Socket, player2Socket, { entryFee, animeId }) {
    const matchId = uuidv4();
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const matchData = {
      matchId,
      roomCode,
      type: MatchTypes.DUEL_1V1,
      players: [
        { id: player1Socket.user.id, username: player1Socket.user.username },
        { id: player2Socket.user.id, username: player2Socket.user.username }
      ],
      entryFee,
      animeId,
      status: 'PREPARING',
      createdAt: Date.now()
    };

    // Salva estado da partida no cache para o GameController assumir
    await cacheProvider.set(`match:active:${matchId}`, matchData, 1800); // 30 min

    // Coloca ambos na sala do socket
    player1Socket.join(`match:${matchId}`);
    player2Socket.join(`match:${matchId}`);

    // Limpa referências de fila
    player1Socket.currentMatchQueue = null;
    player2Socket.currentMatchQueue = null;

    // Emite o evento de sucesso para ambos
    this.nsp.to(`match:${matchId}`).emit(socketConfig.events.MATCH_FOUND, matchData);

    logger.info(`[Matchmaking] Partida criada: ${matchId} entre ${player1Socket.user.username} e ${player2Socket.user.username}`);
  }

  /**
   * Remove o jogador da fila se ele cancelar ou desconectar.
   */
  async handleCancelSearch(socket) {
    if (socket.currentMatchQueue) {
      try {
        const queueKey = socket.currentMatchQueue;
        const allPlayers = await cacheProvider.client.lrange(queueKey, 0, -1);
        
        for (const pString of allPlayers) {
          const p = JSON.parse(pString);
          if (p.socketId === socket.id) {
            await cacheProvider.client.lrem(queueKey, 0, pString);
            break;
          }
        }
        
        socket.currentMatchQueue = null;
        socket.emit('match:cancelled');
        logger.info(`[Matchmaking] Busca cancelada para: ${socket.user.username}`);
      } catch (error) {
        logger.error(`[Matchmaking] Erro ao cancelar busca: ${error.message}`);
      }
    }
  }
}

module.exports = MatchmakingController;