const logger = require('../../config/logger');
const SocketEvents = require('./socket.events');
const cacheProvider = require('../../config/cache');

/**
 * connectionEvents - Gerencia os gatilhos de baixo nível de conexão e desconexão.
 * 
 * @param {import('socket.io').Server} io - Instância do servidor Socket.IO
 * @param {import('socket.io').Socket} socket - Instância do socket individual
 */
const connectionEvents = (io, socket) => {
  const { user } = socket;

  // 1. Lógica disparada imediatamente na conexão
  const handleConnection = async () => {
    logger.info(`[Socket:Connection] Usuário ${user.username} conectado via socket ${socket.id}`);

    // Ingressar em sala privada para notificações P2P
    const privateRoom = `user:${user.id}`;
    socket.join(privateRoom);

    // Opcional: Registrar a data da última conexão no Redis para auditoria rápida
    await cacheProvider.set(`user:last_socket:${user.id}`, {
      socketId: socket.id,
      connectedAt: new Date().toISOString()
    }, 86400); // 24h
  };

  // 2. Lógica de tratamento de erro no socket
  const handleError = (error) => {
    logger.error(`[Socket:Error] Erro no socket de ${user.username}:`, {
      message: error.message,
      stack: error.stack
    });
    
    socket.emit(SocketEvents.SYSTEM.ERROR, {
      message: 'Ocorreu um erro na sua conexão em tempo real.',
      code: 'SOCKET_INTERNAL_ERROR'
    });
  };

  // 3. Lógica disparada na desconexão
  const handleDisconnect = async (reason) => {
    logger.info(`[Socket:Disconnect] Usuário ${user.username} desconectado. Motivo: ${reason}`);

    // Se o usuário estiver em uma sala de matchmaking ou lobby, 
    // a limpeza é delegada aos respectivos controladores via listeners de 'disconnect'.
  };

  // Execução inicial
  handleConnection();

  // Registro dos listeners nativos
  socket.on(SocketEvents.SYSTEM.ERROR, handleError);
  socket.on(SocketEvents.SYSTEM.DISCONNECT, handleDisconnect);
};

module.exports = connectionEvents;