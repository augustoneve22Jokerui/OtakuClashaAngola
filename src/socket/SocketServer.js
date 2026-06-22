const { Server } = require('socket.io');

let createAdapter = null;

/**
 * ==================================================
 * IMPORTAÇÃO SEGURA DO REDIS ADAPTER
 * ==================================================
 * Evita crash se o pacote não estiver instalado
 */
try {
  ({ createAdapter } = require('@socket.io/redis-adapter'));
} catch (error) {
  console.warn(
    '[Socket.IO] Redis Adapter não encontrado. Modo standalone ativado.'
  );
}

const { serverOptions, socketConfig } = require('../config/socket');
const cacheProvider = require('../config/cache');
const TokenHelper = require('../utils/TokenHelper');
const logger = require('../config/logger');

// Controllers
const LobbyController = require('./controllers/LobbyController');
const MatchmakingController = require('./controllers/MatchmakingController');
const PresenceController = require('./controllers/PresenceController');

class SocketServer {
  constructor() {
    this.io = null;
  }

  init(httpServer) {
    this.io = new Server(httpServer, serverOptions);

    /**
     * ==================================================
     * REDIS ADAPTER HÍBRIDO
     * ==================================================
     * - Usa Redis se possível
     * - Senão continua em modo standalone
     * - Nunca quebra o servidor
     */
    try {
      const redisEnabled = process.env.REDIS_ENABLED === 'true';

      const hasRedisClient =
        cacheProvider &&
        cacheProvider.client &&
        typeof cacheProvider.client.duplicate === 'function';

      const hasAdapter = typeof createAdapter === 'function';

      if (redisEnabled && hasRedisClient && hasAdapter) {
        const pubClient = cacheProvider.client;
        const subClient = pubClient.duplicate();

        this.io.adapter(createAdapter(pubClient, subClient));

        logger.info(
          '[Socket.IO] Redis Adapter ativado com sucesso.'
        );
      } else {
        logger.warn(
          '[Socket.IO] Modo standalone (sem Redis Adapter).'
        );
      }
    } catch (error) {
      logger.warn(
        `[Socket.IO] Falha ao ativar Redis Adapter. Fallback aplicado: ${error.message}`
      );
    }

    /**
     * ==================================================
     * MIDDLEWARE GLOBAL DE AUTENTICAÇÃO
     * ==================================================
     */
    this.io.use(async (socket, next) => {
      try {
        const token =
          socket.handshake.auth.token ||
          socket.handshake.headers['authorization']?.split(' ')[1];

        if (!token) {
          return next(
            new Error('Autenticação necessária para conexão socket.')
          );
        }

        const decoded = TokenHelper.verifyAccessToken(token);

        socket.user = {
          id: decoded.sub || decoded.id,
          role: decoded.role,
          username: decoded.username
        };

        logger.info(
          `[SocketServer] Usuário autenticado: ${socket.user.username} (${socket.id})`
        );

        next();
      } catch (err) {
        logger.warn(
          `[SocketServer] Falha na conexão socket: ${err.message}`
        );
        next(new Error('Token inválido ou expirado.'));
      }
    });

    this.setupNamespaces();
    this.setupGlobalEvents();

    logger.info('🚀 Socket.IO inicializado (modo híbrido ativo).');

    return this.io;
  }

  /**
   * Namespaces
   */
  setupNamespaces() {
    const gameNamespace = this.io.of(socketConfig.namespaces.GAME);
    const chatNamespace = this.io.of(socketConfig.namespaces.CHAT);

    new LobbyController(gameNamespace);
    new MatchmakingController(gameNamespace);
    new PresenceController(this.io);
  }

  /**
   * Eventos globais
   */
  setupGlobalEvents() {
    this.io.on('connection', (socket) => {
      socket.join(`user:${socket.user.id}`);

      socket.on('error', (error) => {
        logger.error(`[Socket] Erro ${socket.id}:`, error);
      });

      socket.on('disconnect', (reason) => {
        logger.info(
          `[Socket] Desconectado: ${socket.user.username} (${reason})`
        );
      });
    });
  }

  /**
   * Emit individual user
   */
  emitToUser(userId, event, data) {
    if (this.io) {
      this.io.to(`user:${userId}`).emit(event, data);
    }
  }

  /**
   * Emit room or namespace
   */
  emitToRoom(room, event, data, namespace = '/') {
    if (this.io) {
      this.io.of(namespace).to(room).emit(event, data);
    }
  }
}

module.exports = new SocketServer();
