const logger = require('../../config/logger');
const { socketConfig } = require('../../config/socket');

/**
 * ChatController - Gerencia a comunicação em tempo real entre usuários.
 * Suporta chat global, salas de partidas e mensagens de guilda.
 */
class ChatController {
  /**
   * @param {import('socket.io').Namespace} nsp - Namespace do Socket.IO (ex: /chat)
   */
  constructor(nsp) {
    this.nsp = nsp;
    this.setupEvents();
  }

  /**
   * Configura os listeners de eventos de chat.
   */
  setupEvents() {
    this.nsp.on('connection', (socket) => {
      // Entrar em uma sala de chat específica (Global, Guilda ou Match)
      socket.on('chat:join_room', (data) => {
        this.handleJoinRoom(socket, data);
      });

      // Enviar mensagem
      socket.on('chat:send_message', (data) => {
        this.handleMessage(socket, data);
      });

      // Indicador de digitação
      socket.on('chat:typing', (data) => {
        this.handleTyping(socket, data);
      });

      // Sair de uma sala
      socket.on('chat:leave_room', (data) => {
        this.handleLeaveRoom(socket, data);
      });
    });
  }

  /**
   * Gerencia a entrada do usuário em canais de chat.
   */
  handleJoinRoom(socket, { roomId }) {
    if (!roomId) return;

    socket.join(roomId);
    
    // Notifica os outros membros (Opcional, geralmente evitado em chats globais)
    // this.nsp.to(roomId).emit('chat:user_joined', { username: socket.user.username });

    logger.debug(`[ChatController] Usuário ${socket.user.username} entrou no chat: ${roomId}`);
  }

  /**
   * Processa o envio e a difusão de mensagens.
   */
  handleMessage(socket, { roomId, message, type = 'TEXT' }) {
    if (!roomId || !message || message.trim().length === 0) return;

    const messagePayload = {
      id: Date.now().toString(), // Em produção, usar UUID ou ID do banco
      sender: {
        id: socket.user.id,
        username: socket.user.username,
        role: socket.user.role
      },
      content: message.trim().substring(0, 500), // Limite de 500 caracteres
      type,
      timestamp: new Date().toISOString()
    };

    // Difunde a mensagem para todos na sala, incluindo o remetente
    this.nsp.to(roomId).emit('chat:new_message', messagePayload);

    logger.info(`[ChatController] Mensagem em ${roomId} de ${socket.user.username}`);
  }

  /**
   * Gerencia o estado "está digitando...".
   */
  handleTyping(socket, { roomId, isTyping }) {
    if (!roomId) return;

    // Envia para todos na sala EXCETO para quem está digitando
    socket.to(roomId).emit('chat:user_typing', {
      username: socket.user.username,
      isTyping
    });
  }

  /**
   * Gerencia a saída de canais de chat.
   */
  handleLeaveRoom(socket, { roomId }) {
    if (!roomId) return;
    
    socket.leave(roomId);
    logger.debug(`[ChatController] Usuário ${socket.user.username} saiu do chat: ${roomId}`);
  }
}

module.exports = ChatController;