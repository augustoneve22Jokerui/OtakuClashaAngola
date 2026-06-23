const env = require('./env');

/**
 * Configuração Global do Socket.IO
 * Define comportamentos para Matchmaking, Battle Royale e Real-time Presence.
 */
const socketConfig = {
  // Configurações de CORS para o WebSocket
  cors: {
    origin: env.NODE_ENV === 'production' ? env.API_URL : '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  
  // Limites e Timeouts para estabilidade
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 45000,
  maxHttpBufferSize: 1e6, // 1MB limite de payload
  
  // Configuração para o Redis Adapter (Escalabilidade horizontal)
  adapter: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
  },

  // Namespaces da Aplicação
  namespaces: {
    GAME: '/game',
    CHAT: '/chat',
    NOTIFICATION: '/notifications'
  },

  // Constantes de Eventos (Padronização Enterprise)
  events: {
    CONNECTION: 'connection',
    DISCONNECT: 'disconnect',
    ERROR: 'error',
    // Eventos de Jogo
    JOIN_LOBBY: 'game:join_lobby',
    LEAVE_LOBBY: 'game:leave_lobby',
    MATCH_FOUND: 'game:match_found',
    START_QUIZ: 'game:start_quiz',
    SUBMIT_ANSWER: 'game:submit_answer',
    SCORE_UPDATE: 'game:score_update',
    GAME_OVER: 'game:game_over',
    // Eventos de Battle Royale
    BR_ROOM_CREATED: 'br:room_created',
    BR_PLAYER_JOINED: 'br:player_joined',
    BR_PLAYER_ELIMINATED: 'br:player_eliminated',
    BR_NEW_ROUND: 'br:new_round',
    // Eventos de Presença
    USER_ONLINE: 'presence:online',
    USER_OFFLINE: 'presence:offline',
  }
};

/**
 * Configuração de Opções para o Servidor Socket.IO
 */
const serverOptions = {
  cors: socketConfig.cors,
  pingTimeout: socketConfig.pingTimeout,
  pingInterval: socketConfig.pingInterval,
  connectTimeout: socketConfig.connectTimeout,
  maxHttpBufferSize: socketConfig.maxHttpBufferSize,
  transports: ['websocket', 'polling'],
  allowEIO3: true // Compatibilidade retroativa se necessário
};

module.exports = {
  socketConfig,
  serverOptions
};