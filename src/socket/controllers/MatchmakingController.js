/**
 * ⚔️ OTAKU CLASH ANGOLA - MATCHMAKING CONTROLLER
 * Versão: 2.0.0 - Enterprise Resilient
 * Descrição: Gerencia filas de espera e pareamento de duelos 1v1 em tempo real.
 */

const cacheProvider = require('../../config/hybridRedis');
const logger = require('../../config/logger');
const { socketConfig } = require('../../config/socket');
const { MatchTypes } = require('../../core/constants/MatchTypes');
const { v4: uuidv4 } = require('uuid');

class MatchmakingController {
  /**
   * @param {import('socket.io').Namespace} nsp - Namespace /game
   */
  constructor(nsp) {
    this.nsp = nsp;
    this.queueKeyPrefix = 'matchmaking:queue:';
    this.setupEvents();
  }

  /**
   * Configura listeners para eventos de pareamento
   */
  setupEvents() {
    this.nsp.on('connection', (socket) => {
      // Iniciar busca por oponente
      socket.on('match:find', async (data) => {
        await this.handleFindMatch(socket, data);
      });

      // Cancelar busca voluntariamente
      socket.on('match:cancel', async () => {
        await this.handleCancelSearch(socket);
      });

      // Limpeza automática em caso de queda de conexão durante a espera
      socket.on('disconnect', async () => {
        await this.handleCancelSearch(socket);
      });
    });
  }

  /**
   * 🔍 PROCESSA ENTRADA NA FILA
   * @param {Object} data - { entryFee, animeId }
   */
  async handleFindMatch(socket, { entryFee = 0, animeId = null }) {
    const userId = socket.user.id;
    const username = socket.user.username;

    try {
      // 1. Define a chave da fila baseada no valor da aposta e tema (segmentação)
      const queueKey = `${this.queueKeyPrefix}${entryFee}:${animeId || 'any'}`;

      // 2. Prepara os dados do jogador para a fila
      const playerInfo = {
        socketId: socket.id,
        userId: userId,
        username: username,
        level: socket.user.level || 1,
        entryFee,
        animeId,
        joinedAt: Date.now()
      };

      logger.info(`[Matchmaking] Usuário ${username} buscando duelo (${entryFee} AKZ)...`);

      // 3. Tenta encontrar um oponente (LPOP - First In, First Out)
      // O NullRedisClient agora suporta este comando em memória
      const opponentDataString = await cacheProvider.client.lpop(queueKey);

      if (opponentDataString) {
        const opponent = JSON.parse(opponentDataString);

        // 4. Validação do Oponente
        // Verifica se o oponente ainda está conectado e se não é o próprio usuário
        const opponentSocket = this.nsp.sockets.get(opponent.socketId);

        if (opponentSocket && opponent.userId !== userId) {
          // 🏆 PAR ENCONTRADO!
          return await this.createMatch(socket, opponentSocket, { entryFee, animeId });
        } else {
          // Oponente inválido/offline, tenta novamente ou se coloca na fila
          logger.debug(`[Matchmaking] Oponente em ${queueKey} inválido. Re-enfileirando atual.`);
          return await this.handleFindMatch(socket, { entryFee, animeId });
        }
      }

      // 5. Se ninguém na fila, o jogador entra para esperar (RPUSH)
      await cacheProvider.client.rpush(queueKey, JSON.stringify(playerInfo));
      
      // Define expiração da fila para 5 minutos (limpeza de segurança)
      if (cacheProvider.enabled) {
        await cacheProvider.client.expire(queueKey, 300);
      }
      
      socket.currentMatchQueue = queueKey;
      socket.emit('match:searching', { 
        status: 'waiting', 
        queue: queueKey,
        estimatedTime: '30s' 
      });

    } catch (error) {
      logger.error(`[Matchmaking:Error] ${error.message}`);
      socket.emit('match:error', { message: 'Erro ao processar fila de espera.' });
    }
  }

  /**
   * ⚔️ CRIA A INSTÂNCIA DO DUELO
   */
  async createMatch(p1Socket, p2Socket, { entryFee, animeId }) {
    const matchId = uuidv4();
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const matchData = {
      matchId,
      roomCode,
      type: MatchTypes.DUEL_1V1 || '1V1_DUEL',
      players: [
        { id: p1Socket.user.id, username: p1Socket.user.username },
        { id: p2Socket.user.id, username: p2Socket.user.username }
      ],
      entryFee,
      animeId,
      status: 'PREPARING',
      startTime: Date.now()
    };

    try {
      // 1. Registra a partida ativa no Cache para persistência de estado durante o jogo
      await cacheProvider.client.set(`match:active:${matchId}`, JSON.stringify(matchData), 'EX', 1800);

      // 2. Coloca ambos os jogadores em uma sala privada no Socket.IO
      const matchRoom = `match:${matchId}`;
      p1Socket.join(matchRoom);
      p2Socket.join(matchRoom);

      // 3. Limpa referências de fila nos sockets
      p1Socket.currentMatchQueue = null;
      p2Socket.currentMatchQueue = null;

      // 4. Notifica o sucesso do pareamento para ambos
      this.nsp.to(matchRoom).emit(socketConfig.events.MATCH_FOUND || 'game:match_found', matchData);

      logger.info(`[Matchmaking:Success] Duelo criado: ${matchId} | ${p1Socket.user.username} vs ${p2Socket.user.username}`);

    } catch (error) {
      logger.error(`[Matchmaking:CreateMatch] Erro: ${error.message}`);
      this.nsp.to(p1Socket.id).to(p2Socket.id).emit('match:error', { message: 'Erro ao inicializar arena.' });
    }
  }

  /**
   * 🛑 CANCELA BUSCA E LIMPA FILA
   */
  async handleCancelSearch(socket) {
    if (!socket.currentMatchQueue) return;

    try {
      const queueKey = socket.currentMatchQueue;
      
      // Recupera todos da fila para remover o socket específico
      const players = await cacheProvider.client.lrange(queueKey, 0, -1);
      
      for (const pStr of players) {
        const p = JSON.parse(pStr);
        if (p.socketId === socket.id) {
          await cacheProvider.client.lrem(queueKey, 0, pStr);
          break;
        }
      }

      socket.currentMatchQueue = null;
      socket.emit('match:cancelled');
      
      logger.info(`[Matchmaking] Usuário ${socket.user.username} saiu da fila.`);
    } catch (error) {
      logger.error(`[Matchmaking:Cancel] Erro: ${error.message}`);
    }
  }
}

module.exports = MatchmakingController;