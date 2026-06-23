/**
 * ⚡ OTAKU CLASH ANGOLA - SOCKET.IO SERVER ENGINE
 * Versão: 2.0.0 - Enterprise Hybrid
 * Descrição: Gestão de conexões em tempo real, namespaces e adaptadores.
 */

const { Server } = require('socket.io');
const { serverOptions, socketConfig } = require('../config/socket');
const hybridRedis = require('../config/hybridRedis');
const TokenHelper = require('../utils/TokenHelper');
const logger = require('../config/logger');

// Importação segura do Adaptador Redis
let createAdapter = null;
try {
  createAdapter = require('@socket.io/redis-adapter').createAdapter;
} catch (e) {
  logger.warn('[Socket:Adapter] Dependência @socket.io/redis-adapter não encontrada. Usando modo Standalone.');
}

// Importação de Controladores de Namespaces
const LobbyController = require('./controllers/LobbyController');
const MatchmakingController = require('./controllers/MatchmakingController');
const PresenceController = require('./controllers/PresenceController');
const ChatController = require('./controllers/ChatController');

class SocketServer {
  constructor() {
    this.io = null;
  }

  /**
   * Inicializa o servidor Socket.IO vinculado ao servidor HTTP
   */
  init(httpServer) {
    this.io = new Server(httpServer, serverOptions);

    /**
     * 🔄 CONFIGURAÇÃO DE ADAPTADOR (REDIS HYBRID)
     * Ativa escalabilidade horizontal apenas se o Redis real estiver online.
     */
    try {
      if (hybridRedis.enabled && createAdapter) {
        const pubClient = hybridRedis.client;
        const subClient = pubClient.duplicate();
        
        this.io.adapter(createAdapter(pubClient, subClient));
        logger.info('[SocketServer] Redis Adapter ativado (Cluster Mode Ready).');
      } else {
        logger.warn('[SocketServer] Redis offline ou Adaptador ausente. Operando em modo Single Instance.');
      }
    } catch (err) {
      logger.error(`[SocketServer:Adapter] Falha ao configurar adaptador: ${err.message}`);
    }

    /**
     * 🛡️ MIDDLEWARE DE AUTENTICAÇÃO GLOBAL
     * Garante que apenas usuários com JWT válido conectem ao WebSocket.
     */
    this.io.use((socket, next) => {
      try {
        // O token pode vir no objeto 'auth' (Frontend moderno) ou nos headers
        const token = socket.handshake.auth?.token || 
                      socket.handshake.headers['authorization']?.split(' ')[1];

        if (!token) {
          logger.warn(`[SocketServer:Auth] Tentativa de conexão sem token via: ${socket.id}`);
          return next(new Error('Acesso negado: Token não fornecido.'));
        }

        // Valida o Access Token usando o Helper centralizado
        const decoded = TokenHelper.verifyAccessToken(token);

        // Injeta os dados do usuário no socket para uso nos controllers
        socket.user = {
          id: decoded.sub || decoded.id,
          role: decoded.role,
          username: decoded.username,
          email: decoded.email
        };

        logger.info(`[SocketServer:Auth] Handshake autorizado: ${socket.user.username} (${socket.id})`);
        next();
      } catch (err) {
        logger.warn(`[SocketServer:Auth] Falha no handshake: ${err.message}`);
        next(new Error('Acesso negado: Sessão inválida ou expirada.'));
      }
    });

    // Inicializa os Namespaces e Listeners
    this.setupNamespaces();
    this.setupGlobalEvents();

    return this.io;
  }

  /**
   * Configura os canais lógicos (Namespaces) da aplicação
   */
  setupNamespaces() {
    const gameNamespace = this.io.of(socketConfig.namespaces.GAME || '/game');
    const chatNamespace = this.io.of(socketConfig.namespaces.CHAT || '/chat');
    const notifyNamespace = this.io.of(socketConfig.namespaces.NOTIFICATION || '/notifications');

    // Acopla os controladores aos respectivos namespaces
    new LobbyController(gameNamespace);
    new MatchmakingController(gameNamespace);
    new PresenceController(this.io); // Presence monitora o servidor inteiro
    new ChatController(chatNamespace);

    logger.info('[SocketServer] Namespaces operacionais: /game, /chat, /notifications');
  }

  /**
   * Configura eventos básicos de conexão no nível raiz
   */
  setupGlobalEvents() {
    this.io.on('connection', (socket) => {
      // O usuário entra em uma sala privada baseada no seu ID (para notificações P2P)
      const userRoom = `user:${socket.user.id}`;
      socket.join(userRoom);

      socket.on('error', (error) => {
        logger.error(`[Socket:Error] Cliente ${socket.id}: ${error.message}`);
      });

      socket.on('disconnect', (reason) => {
        logger.info(`[Socket:Disconnect] Cliente ${socket.user.username} saiu. Motivo: ${reason}`);
      });
    });
  }

  /**
   * Utilitário para disparar eventos para um usuário específico em qualquer namespace
   */
  emitToUser(userId, event, data) {
    if (this.io) {
      this.io.to(`user:${userId}`).emit(event, data);
    }
  }

  /**
   * Utilitário para disparar eventos para uma sala específica em um namespace
   */
  emitToRoom(namespace, room, event, data) {
    if (this.io) {
      this.io.of(namespace).to(room).emit(event, data);
    }
  }
}

module.exports = new SocketServer();