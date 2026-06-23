/**
 * ⚔️ OTAKU CLASH ANGOLA - BATTLE ROYALE SOCKET CONTROLLER
 * Versão: 2.0.0 - Enterprise Massively Multiplayer
 * Descrição: Gerencia o ciclo de vida de arenas massivas, eliminação e premiação.
 */

const cacheProvider = require('../../config/hybridRedis');
const logger = require('../../config/logger');
const { socketConfig } = require('../../config/socket');
const { v4: uuidv4 } = require('uuid');

class BattleRoyaleController {
  /**
   * @param {import('socket.io').Namespace} nsp - Namespace /game
   */
  constructor(nsp) {
    this.nsp = nsp;
    this.roomPrefix = 'br:room:';
    this.setupEvents();
  }

  /**
   * Configura listeners para o modo Battle Royale
   */
  setupEvents() {
    this.nsp.on('connection', (socket) => {
      // 1. Criar Sala (Staff Only)
      socket.on(socketConfig.events.BR_ROOM_CREATED || 'br:create_room', async (data) => {
        await this.handleCreateRoom(socket, data);
      });

      // 2. Entrar na Arena (Handshake do Player)
      socket.on(socketConfig.events.BR_PLAYER_JOINED || 'br:join_room', async (data) => {
        await this.handleJoinRoom(socket, data);
      });

      // 3. Submissão de Resposta da Rodada
      socket.on(socketConfig.events.SUBMIT_ANSWER || 'br:submit_answer', async (data) => {
        await this.handleBRAnswer(socket, data);
      });

      // 4. Início Manual da Partida (Staff Only)
      socket.on('br:start_game', async (data) => {
        await this.handleStartGame(socket, data);
      });
    });
  }

  /**
   * 🏗️ CRIAÇÃO DA ARENA (STAFF / ADMIN)
   */
  async handleCreateRoom(socket, { animeId, title, maxPlayers = 100, entryFee = 0 }) {
    if (socket.user.role !== 'ADMIN' && socket.user.role !== 'MODERATOR') {
      return socket.emit('br:error', { message: 'Apenas a STAFF pode abrir arenas.' });
    }

    const roomId = uuidv4();
    const roomKey = `${this.roomPrefix}${roomId}`;

    const brRoom = {
      id: roomId,
      title: title || 'Grande Batalha Otaku',
      animeId,
      entryFee,
      status: 'LOBBY',
      currentRound: 0,
      players: {}, // Mapeamento ID -> Dados
      survivorsCount: 0,
      totalPlayers: 0,
      maxPlayers,
      createdAt: Date.now()
    };

    try {
      await cacheProvider.client.set(roomKey, JSON.stringify(brRoom), 'EX', 7200); // 2h TTL
      
      // Notifica o criador e o sistema global (Broadcast)
      socket.emit('br:room_ready', { roomId });
      this.nsp.emit('br:new_arena_available', { roomId, title, entryFee });
      
      logger.info(`[BattleRoyale] Nova arena aberta: ${roomId} por ${socket.user.username}`);
    } catch (error) {
      logger.error(`[BR:Create] Erro: ${error.message}`);
      socket.emit('br:error', { message: 'Falha ao inicializar arena no cache.' });
    }
  }

  /**
   * 🏃 ENTRADA DO JOGADOR NA ARENA
   */
  async handleJoinRoom(socket, { roomId }) {
    const roomKey = `${this.roomPrefix}${roomId}`;
    
    try {
      const data = await cacheProvider.client.get(roomKey);
      if (!data) return socket.emit('br:error', { message: 'Arena não localizada.' });

      const room = JSON.parse(data);

      if (room.status !== 'LOBBY') {
        return socket.emit('br:error', { message: 'A partida já está em andamento.' });
      }

      if (Object.keys(room.players).length >= room.maxPlayers) {
        return socket.emit('br:error', { message: 'Esta arena atingiu o limite de vagas.' });
      }

      // Adiciona jogador ao estado da sala
      const userId = socket.user.id;
      room.players[userId] = {
        id: userId,
        username: socket.user.username,
        socketId: socket.id,
        isEliminated: false,
        joinedAt: Date.now()
      };
      
      room.survivorsCount = Object.keys(room.players).length;
      room.totalPlayers = room.survivorsCount;

      await cacheProvider.client.set(roomKey, JSON.stringify(room), 'EX', 7200);
      
      // Ingressa na sala física do Socket.IO
      const roomName = `br_arena:${roomId}`;
      socket.join(roomName);
      socket.currentBRRoom = roomId;

      // Notifica todos na arena
      this.nsp.to(roomName).emit('br:player_list_updated', {
        total: room.totalPlayers,
        survivors: room.survivorsCount
      });

      logger.info(`[BattleRoyale] ${socket.user.username} entrou na arena ${roomId}`);

    } catch (error) {
      logger.error(`[BR:Join] Erro: ${error.message}`);
    }
  }

  /**
   * ✅ PROCESSA RESPOSTA E ELIMINAÇÃO
   */
  async handleBRAnswer(socket, { roomId, questionId, optionId, round }) {
    if (!socket.currentBRRoom || socket.currentBRRoom !== roomId) return;

    const roomKey = `${this.roomPrefix}${roomId}`;
    
    try {
      const data = await cacheProvider.client.get(roomKey);
      if (!data) return;

      const room = JSON.parse(data);
      if (room.status !== 'IN_PROGRESS' || room.currentRound !== round) return;

      const player = room.players[socket.user.id];
      if (!player || player.isEliminated) return;

      // 1. Validação da Resposta (Server-Side)
      const questionsService = require('../../modules/questions/questions.service');
      const validation = await questionsService.validateAnswer(questionId, optionId);

      // 2. Lógica de Eliminação
      if (!validation.isCorrect) {
        player.isEliminated = true;
        room.survivorsCount -= 1;
        
        socket.emit(socketConfig.events.BR_PLAYER_ELIMINATED || 'br:player_eliminated', {
          reason: 'Resposta Incorrecta',
          round
        });

        this.nsp.to(`br_arena:${roomId}`).emit('br:feed_update', {
          message: `${player.username} foi eliminado!`
        });
      } else {
        socket.emit('br:round_success', { round });
      }

      // 3. Atualiza estado e verifica vencedor
      await cacheProvider.client.set(roomKey, JSON.stringify(room), 'EX', 7200);
      await this.checkWinner(room);

    } catch (error) {
      logger.error(`[BR:Answer] Erro: ${error.message}`);
    }
  }

  /**
   * 🏁 VERIFICAÇÃO DE VENCEDOR E ENCERRAMENTO
   */
  async checkWinner(room) {
    const alivePlayers = Object.values(room.players).filter(p => !p.isEliminated);

    // Condição de Vitória: Apenas 1 sobrevivente restando
    if (alivePlayers.length === 1 && room.totalPlayers > 1) {
      const winner = alivePlayers[0];
      room.status = 'FINISHED';
      room.winnerId = winner.id;

      await cacheProvider.client.set(`${this.roomPrefix}${room.id}`, JSON.stringify(room), 'EX', 7200);

      this.nsp.to(`br_arena:${room.id}`).emit(socketConfig.events.GAME_OVER || 'br:game_over', {
        winner: { id: winner.id, username: winner.username },
        totalRounds: room.currentRound
      });

      // Persistência e premiação no banco via Service
      const brService = require('../../modules/battleRoyale/battleRoyale.service');
      await brService.finalizeBattleRoyale(room.id, winner.id);

      logger.info(`[BattleRoyale] Vencedor coroado na arena ${room.id}: ${winner.username}`);
    } 
    else if (alivePlayers.length === 0) {
      // Caso improvável onde todos erram na mesma rodada
      this.nsp.to(`br_arena:${room.id}`).emit('br:game_over', { winner: null, message: 'Não houve sobreviventes.' });
      room.status = 'FINISHED';
      await cacheProvider.client.set(`${this.roomPrefix}${room.id}`, JSON.stringify(room), 'EX', 7200);
    }
  }

  /**
   * 🚦 INÍCIO DA PARTIDA (STAFF ACTION)
   */
  async handleStartGame(socket, { roomId }) {
    if (socket.user.role !== 'ADMIN' && socket.user.role !== 'MODERATOR') return;

    const roomKey = `${this.roomPrefix}${roomId}`;
    const data = await cacheProvider.client.get(roomKey);
    if (!data) return;

    const room = JSON.parse(data);
    room.status = 'IN_PROGRESS';
    room.currentRound = 1;

    await cacheProvider.client.set(roomKey, JSON.stringify(room), 'EX', 7200);
    
    this.nsp.to(`br_arena:${roomId}`).emit('br:game_started', {
      round: 1,
      survivors: room.survivorsCount
    });
  }
}

module.exports = BattleRoyaleController;