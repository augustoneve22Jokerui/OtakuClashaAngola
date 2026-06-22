const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { serverOptions, socketConfig } = require('../config/socket');
const cacheProvider = require('../config/cache');
const TokenHelper = require('../utils/TokenHelper');
const logger = require('../config/logger');

// Importação dos controladores de eventos (serão gerados a seguir)
const LobbyController = require('./controllers/LobbyController');
const MatchmakingController = require('./controllers/MatchmakingController');
const PresenceController = require('./controllers/PresenceController');

/**
 * SocketServer - Gerenciador central de WebSockets.
 * Responsável pela inicialização, autenticação e roteamento de eventos.
 */
class SocketServer {
  constructor() {
    this.io = null;
  }

  /**
   * Inicializa o servidor Socket.IO anexado ao servidor HTTP.
   * @param {Object} httpServer - Instância do servidor HTTP do Node.js.
   */
  init(httpServer) {
    this.io = new Server(httpServer, serverOptions);

    // Configura o Adaptador Redis para escalabilidade horizontal
    const pubClient = cacheProvider.client;
    const subClient = pubClient.duplicate();
    this.io.adapter(createAdapter(pubClient, subClient));

    // Middleware de Autenticação Global
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers['authorization']?.split(' ')[1];

        if (!token) {
          return next(new Error('Autenticação necessária para conexão socket.'));
        }

        const decoded = TokenHelper.verifyAccessToken(token);
        
        // Injeta os dados do usuário no socket para uso nos controllers
        socket.user = {
          id: decoded.sub || decoded.id,
          role: decoded.role,
          username: decoded.username
        };

        logger.info(`[SocketServer] Usuário autenticado: ${socket.user.username} (${socket.id})`);
        next();
      } catch (err) {
        logger.warn(`[SocketServer] Falha na conexão socket: ${err.message}`);
        next(new Error('Token inválido ou expirado.'));
      }
    });

    this.setupNamespaces();
    this.setupGlobalEvents();

    logger.info('🚀 Servidor Socket.IO inicializado com sucesso.');
    return this.io;
  }

  /**
   * Configura namespaces específicos para separar responsabilidades.
   */
  setupNamespaces() {
    const gameNamespace = this.io.of(socketConfig.namespaces.GAME);
    const chatNamespace = this.io.of(socketConfig.namespaces.CHAT);

    // Instancia controladores para cada namespace
    new LobbyController(gameNamespace);
    new MatchmakingController(gameNamespace);
    new PresenceController(this.io); // Presence costuma ser global ou compartilhado
  }

  /**
   * Configura eventos globais de conexão e desconexão.
   */
  setupGlobalEvents() {
    this.io.on('connection', (socket) => {
      // Entra em uma sala privada do próprio usuário para notificações diretas
      socket.join(`user:${socket.user.id}`);

      socket.on('error', (error) => {
        logger.error(`[Socket] Erro no socket ${socket.id}:`, error);
      });

      socket.on('disconnect', (reason) => {
        logger.info(`[Socket] Usuário desconectado: ${socket.user.username} (${reason})`);
      });
    });
  }

  /**
   * Helper para emitir eventos para um usuário específico em qualquer lugar do cluster.
   */
  emitToUser(userId, event, data) {
    if (this.io) {
      this.io.to(`user:${userId}`).emit(event, data);
    }
  }

  /**
   * Helper para emitir eventos para uma sala específica.
   */
  emitToRoom(room, event, data, namespace = '/') {
    if (this.io) {
      this.io.of(namespace).to(room).emit(event, data);
    }
  }
}

// Exporta como Singleton para ser acessado por Services e Controllers HTTP
module.exports = new SocketServer();