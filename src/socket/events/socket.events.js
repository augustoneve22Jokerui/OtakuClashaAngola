/**
 * SocketEvents - Definição centralizada de todos os eventos do Socket.IO.
 * Organizado por namespaces e contextos para garantir consistência e evitar typos.
 */
const SocketEvents = {
  // EVENTOS GERAIS DE SISTEMA
  SYSTEM: {
    CONNECTION: 'connection',
    DISCONNECT: 'disconnect',
    ERROR: 'system:error',
    EXCEPTION: 'exception',
    UNAUTHORIZED: 'system:unauthorized',
  },

  // EVENTOS DE MATCHMAKING (Duelos 1v1)
  MATCHMAKING: {
    FIND: 'match:find',
    CANCEL: 'match:cancel',
    SEARCHING: 'match:searching',
    FOUND: 'match:found',
    ERROR: 'match:error',
    CANCELLED: 'match:cancelled',
  },

  // EVENTOS DE JOGO (QUIZ / DUELO)
  GAME: {
    JOIN_LOBBY: 'game:join_lobby',
    LEAVE_LOBBY: 'game:leave_lobby',
    PLAYER_READY: 'game:player_ready',
    LOBBY_UPDATED: 'game:lobby_updated',
    START: 'game:start',
    QUESTION_START: 'game:question_start',
    SUBMIT_ANSWER: 'game:submit_answer',
    ANSWER_RESULT: 'game:answer_result',
    SCORE_UPDATE: 'game:score_update',
    ROUND_OVER: 'game:round_over',
    GAME_OVER: 'game:game_over',
    TIME_SYNC: 'game:time_sync',
    OPPONENT_DISCONNECTED: 'game:opponent_disconnected',
  },

  // EVENTOS DE BATTLE ROYALE
  BATTLE_ROYALE: {
    CREATE_ROOM: 'br:create_room',
    ROOM_CREATED: 'br:room_created',
    JOIN_ROOM: 'br:join_room',
    PLAYER_JOINED: 'br:player_joined',
    PLAYER_ELIMINATED: 'br:player_eliminated',
    PLAYER_LIST_UPDATED: 'br:player_list_updated',
    ROUND_START: 'br:round_start',
    SUBMIT_ANSWER: 'br:submit_answer',
    ROUND_SUCCESS: 'br:round_success',
    FEED_UPDATE: 'br:feed_update',
    GAME_OVER: 'br:game_over',
    ERROR: 'br:error',
  },

  // EVENTOS DE CHAT
  CHAT: {
    JOIN_ROOM: 'chat:join_room',
    LEAVE_ROOM: 'chat:leave_room',
    SEND_MESSAGE: 'chat:send_message',
    NEW_MESSAGE: 'chat:new_message',
    TYPING: 'chat:typing',
    USER_TYPING: 'chat:user_typing',
    SYSTEM_MESSAGE: 'chat:system_message',
  },

  // EVENTOS DE PRESENÇA E NOTIFICAÇÕES
  PRESENCE: {
    USER_ONLINE: 'presence:online',
    USER_OFFLINE: 'presence:offline',
    NOTIFICATION_RECEIVED: 'notification:received',
    FRIEND_ACTIVE: 'friend:active',
  }
};

module.exports = Object.freeze(SocketEvents);