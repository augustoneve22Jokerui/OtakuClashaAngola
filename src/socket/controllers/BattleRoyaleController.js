const cacheProvider = require('../../config/cache');
const logger = require('../../config/logger');
const { socketConfig } = require('../../config/socket');
const { v4: uuidv4 } = require('uuid');

/**
 * BattleRoyaleController - Gerencia a lógica do modo de sobrevivência multi-jogador.
 */
class BattleRoyaleController {
  /**
   * @param {import('socket.io').Namespace} nsp - Namespace do Socket.IO (ex: /game)
   */
  constructor(nsp) {
    this.nsp = nsp;
    this.setupEvents();
  }

  /**
   * Configura os listeners de eventos para o modo Battle Royale.
   */
  setupEvents() {
    this.nsp.on('connection', (socket) => {
      // Criar sala de Battle Royale (geralmente via Admin ou sistema)
      socket.on('br:create_room', async (data) => {
        await this.handleCreateBRRoom(socket, data);
      });

      // Entrar na sala
      socket.on(socketConfig.events.BR_PLAYER_JOINED, async (data) => {
        await this.handleJoinBR(socket, data);
      });

      // Submeter resposta da rodada
      socket.on('br:submit_answer', async (data) => {
        await this.handleBRAnswer(socket, data);
      });
    });
  }

  /**
   * Cria uma nova instância de sala de Battle Royale.
   */
  async handleCreateBRRoom(socket, { animeId, title, maxPlayers = 100 }) {
    if (socket.user.role !== 'ADMIN' && socket.user.role !== 'MODERATOR') {
      return socket.emit('br:error', { message: 'Sem permissão para criar salas.' });
    }

    const roomId = uuidv4();
    const roomKey = `br:room:${roomId}`;

    const brRoom = {
      id: roomId,
      title: title || 'Grande Torneio Otaku',
      animeId,
      status: 'LOBBY',
      currentRound: 0,
      totalPlayers: 0,
      maxPlayers,
      players: {}, // Objeto para busca O(1) { userId: { username, eliminated, socketId } }
      createdAt: Date.now()
    };

    await cacheProvider.set(roomKey, brRoom, 7200); // 2 horas de vida útil
    
    socket.emit(socketConfig.events.BR_ROOM_CREATED, { roomId });
    logger.info(`[BattleRoyale] Sala criada: ${roomId} por ${socket.user.username}`);
  }

  /**
   * Processa a entrada de um jogador na sala de sobrevivência.
   */
  async handleJoinBR(socket, { roomId }) {
    try {
      const roomKey = `br:room:${roomId}`;
      const brRoom = await cacheProvider.get(roomKey);

      if (!brRoom) {
        return socket.emit('br:error', { message: 'Sala não encontrada.' });
      }

      if (brRoom.status !== 'LOBBY') {
        return socket.emit('br:error', { message: 'A partida já iniciou ou foi finalizada.' });
      }

      if (Object.keys(brRoom.players).length >= brRoom.maxPlayers) {
        return socket.emit('br:error', { message: 'Sala cheia.' });
      }

      // Adiciona jogador ao estado da sala
      brRoom.players[socket.user.id] = {
        id: socket.user.id,
        username: socket.user.username,
        socketId: socket.id,
        eliminated: false,
        lastAnswerCorrect: null,
        joinedAt: Date.now()
      };
      
      brRoom.totalPlayers = Object.keys(brRoom.players).length;

      await cacheProvider.set(roomKey, brRoom, 7200);
      socket.join(`br:${roomId}`);
      socket.currentBRRoom = roomId;

      // Notifica todos na sala
      this.nsp.to(`br:${roomId}`).emit('br:player_list_updated', {
        total: brRoom.totalPlayers,
        players: Object.values(brRoom.players).map(p => ({ username: p.username, eliminated: p.eliminated }))
      });

      logger.info(`[BattleRoyale] Usuário ${socket.user.username} entrou na BR: ${roomId}`);
    } catch (error) {
      logger.error(`[BattleRoyale] Erro ao entrar: ${error.message}`);
    }
  }

  /**
   * Processa a resposta do jogador e aplica a lógica de eliminação.
   */
  async handleBRAnswer(socket, { roomId, isCorrect, round }) {
    const roomKey = `br:room:${roomId}`;
    const brRoom = await cacheProvider.get(roomKey);

    if (!brRoom || brRoom.status !== 'IN_PROGRESS' || brRoom.currentRound !== round) {
      return;
    }

    const player = brRoom.players[socket.user.id];

    if (!player || player.eliminated) {
      return socket.emit('br:error', { message: 'Você já está eliminado desta partida.' });
    }

    // Lógica de eliminação: Errou, está fora.
    if (!isCorrect) {
      player.eliminated = true;
      socket.emit(socketConfig.events.BR_PLAYER_ELIMINATED, {
        reason: 'Resposta incorreta',
        round
      });
      
      // Notifica a sala sobre a queda de um guerreiro
      this.nsp.to(`br:${roomId}`).emit('br:feed_update', {
        message: `${player.username} foi eliminado!`
      });
    } else {
      player.lastAnswerCorrect = true;
      socket.emit('br:round_success', { round });
    }

    await cacheProvider.set(roomKey, brRoom, 7200);
    
    // Verifica se sobrou apenas um vencedor
    await this.checkWinner(brRoom);
  }

  /**
   * Verifica se as condições de vitória foram atingidas.
   */
  async checkWinner(brRoom) {
    const playersArr = Object.values(brRoom.players);
    const alivePlayers = playersArr.filter(p => !p.eliminated);

    if (alivePlayers.length === 1 && brRoom.totalPlayers > 1) {
      const winner = alivePlayers[0];
      brRoom.status = 'FINISHED';
      brRoom.winner = winner;

      await cacheProvider.set(`br:room:${brRoom.id}`, brRoom, 7200);
      
      this.nsp.to(`br:${brRoom.id}`).emit('br:game_over', {
        winner: { username: winner.username, id: winner.id },
        stats: { totalPlayers: brRoom.totalPlayers, totalRounds: brRoom.currentRound }
      });

      logger.info(`[BattleRoyale] Vencedor da sala ${brRoom.id}: ${winner.username}`);
    } else if (alivePlayers.length === 0) {
      // Caso raro onde todos erram na mesma rodada
      this.nsp.to(`br:${brRoom.id}`).emit('br:game_over', { winner: null, message: 'Não houve sobreviventes.' });
    }
  }
}

module.exports = BattleRoyaleController;