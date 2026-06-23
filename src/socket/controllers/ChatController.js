/**
 * 💬 OTAKU CLASH ANGOLA - CHAT CONTROLLER
 * Versão: 2.0.0 - Enterprise Resilient
 * Descrição: Gerencia mensagens em tempo real, histórico local e indicadores de atividade.
 */

const cacheProvider = require('../../config/hybridRedis');
const logger = require('../../config/logger');
const { socketConfig } = require('../../config/socket');

class ChatController {
  /**
   * @param {import('socket.io').Namespace} nsp - Namespace /chat
   */
  constructor(nsp) {
    this.nsp = nsp;
    this.historyLimit = 20; // Mantém apenas as últimas 20 mensagens por sala
    this.setupEvents();
  }

  /**
   * Configura listeners para interações de chat
   */
  setupEvents() {
    this.nsp.on('connection', (socket) => {
      // 1. Entrar em uma Sala de Chat (Global, Partida ou Guilda)
      socket.on('chat:join', async (data) => {
        await this.handleJoinRoom(socket, data);
      });

      // 2. Enviar Mensagem
      socket.on('chat:send', async (data) => {
        await this.handleSendMessage(socket, data);
      });

      // 3. Indicador de Digitação
      socket.on('chat:typing', (data) => {
        this.handleTyping(socket, data);
      });

      // 4. Sair da Sala
      socket.on('chat:leave', (data) => {
        this.handleLeaveRoom(socket, data);
      });
    });
  }

  /**
   * 🚪 ENTRADA NA SALA E RECUPERAÇÃO DE CONTEXTO
   */
  async handleJoinRoom(socket, { roomId }) {
    if (!roomId) return;

    try {
      socket.join(roomId);
      socket.currentChatRoom = roomId;

      // Recupera as últimas mensagens do cache (Híbrido) para o utilizador não entrar no "vazio"
      const historyKey = `chat:history:${roomId}`;
      const historyData = await cacheProvider.client.get(historyKey);
      
      if (historyData) {
        socket.emit('chat:history', JSON.parse(historyData));
      }

      logger.debug(`[Chat] ${socket.user.username} entrou na sala: ${roomId}`);
    } catch (error) {
      logger.error(`[Chat:Join] Erro: ${error.message}`);
    }
  }

  /**
   * ✉️ PROCESSAMENTO DE MENSAGEM
   */
  async handleSendMessage(socket, { roomId, text, type = 'TEXT' }) {
    if (!roomId || !text || text.trim().length === 0) return;

    // Sanitização e Limite: Máximo 500 caracteres
    const sanitizedText = text.trim().substring(0, 500);

    const messagePayload = {
      id: `${Date.now()}_${socket.user.id.substring(0, 4)}`,
      sender: {
        id: socket.user.id,
        username: socket.user.username,
        role: socket.user.role,
        avatarUrl: socket.user.avatarUrl || null
      },
      text: sanitizedText,
      type: type,
      timestamp: new Date().toISOString()
    };

    try {
      // 1. Difunde a mensagem para todos na sala
      this.nsp.to(roomId).emit('chat:message', messagePayload);

      // 2. Atualiza o histórico curto no Cache (Híbrido)
      const historyKey = `chat:history:${roomId}`;
      const historyData = await cacheProvider.client.get(historyKey);
      let history = historyData ? JSON.parse(historyData) : [];

      history.push(messagePayload);
      
      // Mantém apenas o limite definido
      if (history.length > this.historyLimit) {
        history.shift();
      }

      await cacheProvider.client.set(historyKey, JSON.stringify(history), 'EX', 3600); // 1h TTL

    } catch (error) {
      logger.error(`[Chat:Send] Falha ao processar mensagem: ${error.message}`);
    }
  }

  /**
   * ⌨️ GESTÃO DE INDICADOR "ESTÁ A DIGITAR..."
   */
  handleTyping(socket, { roomId, isTyping }) {
    if (!roomId) return;

    // Envia para todos na sala, exceto o remetente
    socket.to(roomId).emit('chat:user_typing', {
      userId: socket.user.id,
      username: socket.user.username,
      isTyping: !!isTyping
    });
  }

  /**
   * 🏃 SAÍDA DA SALA
   */
  handleLeaveRoom(socket, { roomId }) {
    if (!roomId) return;
    socket.leave(roomId);
    socket.currentChatRoom = null;
    logger.debug(`[Chat] ${socket.user.username} saiu da sala: ${roomId}`);
  }

  /**
   * 📢 MENSAGEM DE SISTEMA (ANÚNCIOS)
   * Pode ser chamado internamente por outros controladores
   */
  sendSystemMessage(roomId, text) {
    const payload = {
      id: `sys_${Date.now()}`,
      sender: { id: '0000', username: 'SISTEMA', role: 'SYSTEM' },
      text: text,
      type: 'SYSTEM',
      timestamp: new Date().toISOString()
    };
    this.nsp.to(roomId).emit('chat:message', payload);
  }
}

module.exports = ChatController;