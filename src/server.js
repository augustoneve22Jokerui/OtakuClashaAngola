/**
 * 🚀 OTAKU CLASH ANGOLA - SERVER BOOTSTRAP (SERVER.JS)
 * Versão: Ultra Mega Final - Enterprise Grade
 * Descrição: Ponto de entrada real do sistema. Inicializa Servidor HTTP, WebSockets, 
 * banco de dados, cache e tarefas agendadas (Cron).
 */

const http = require('http');
const app = require('./app');
const env = require('./config/env');
const logger = require('./config/logger');
const db = require('./config/database');
const cacheProvider = require('./config/hybridRedis');
const socketServer = require('./socket/SocketServer');
const cronService = require('./services/cron/CronService');

/**
 * 🏗️ CRIAÇÃO DO SERVIDOR HTTP
 */
const server = http.createServer(app);

/**
 * 🛰️ INICIALIZAÇÃO DO MOTOR REAL-TIME (SOCKET.IO)
 * Conecta o servidor Socket ao servidor HTTP para permitir Matchmaking,
 * Chat e Duelos em tempo real.
 */
try {
  socketServer.init(server);
  logger.info('[Socket.IO] Motor de tempo real inicializado com sucesso.');
} catch (error) {
  logger.error('[Socket.IO] Falha crítica ao inicializar WebSockets:', error);
  process.exit(1);
}

/**
 * ⏰ INICIALIZAÇÃO DE SERVIÇOS EM SEGUNDO PLANO (CRON)
 * Dispara as rotinas de sincronização Jikan e manutenção de cache.
 */
cronService.start();
logger.info('[CronService] Tarefas agendadas activadas.');

/**
 * 🏁 FUNÇÃO DE BOOTSTRAP
 * Valida conexões vitais antes de abrir a porta para tráfego.
 */
async function bootstrap() {
  const PORT = env.PORT || 5000;

  try {
    // 1. Testa Conexão com PostgreSQL (Supabase)
    await db.query('SELECT 1');
    logger.info('[Database] Conexão com Supabase/PostgreSQL validada.');

    // 2. Testa Conexão com Redis
    await cacheProvider.client.ping();
    logger.info('[Redis] Conexão com Redis Cluster validada.');

    // 3. Inicia o servidor
    server.listen(PORT, () => {
      logger.info(`
    ========================================================
    🎮 OTAKU CLASH ANGOLA - CORE BACKEND OPERACIONAL
    🌍 AMBIENTE: ${env.NODE_ENV.toUpperCase()}
    📡 PORTA: ${PORT}
    🔗 URL API: ${env.API_URL}
    🛡️ JWT: ACTIVADO (RS256/HS256)
    🕒 HORA: ${new Date().toLocaleString()}
    ========================================================
      `);
    });

  } catch (error) {
    logger.error('❌ [Bootstrap] Falha catastrófica no arranque do servidor:', {
      message: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

/**
 * 🛡️ TRATAMENTO DE EXCEPÇÕES GLOBAIS
 * Garante que o processo não morra silenciosamente ou deixe recursos abertos.
 */

// Captura promessas rejeitadas não tratadas
process.on('unhandledRejection', (reason, promise) => {
  logger.error('[CRITICAL] Unhandled Rejection at:', {
    promise,
    reason: reason.message || reason
  });
  // Não encerramos o processo aqui para evitar downtime em erros menores,
  // mas registramos com severidade máxima.
});

// Captura erros fatais do Node.js
process.on('uncaughtException', (error) => {
  logger.error('[FATAL] Uncaught Exception detected:', {
    message: error.message,
    stack: error.stack
  });
  
  // Em caso de erro fatal, realizamos um encerramento gracioso
  gracefulShutdown('SIGTERM');
});

/**
 * 🛑 GRACEFUL SHUTDOWN (ENCERRAMENTO GRACIOSO)
 * Fecha conexões com DB e Redis antes de desligar o processo.
 */
async function gracefulShutdown(signal) {
  logger.warn(`[System] Recebido sinal ${signal}. Iniciando encerramento gracioso...`);
  
  server.close(async () => {
    logger.info('[System] Servidor HTTP encerrado.');
    
    try {
      await db.end();
      logger.info('[Database] Pool de conexões encerrado.');
      
      await cacheProvider.client.quit();
      logger.info('[Redis] Conexão com cache encerrada.');
      
      logger.info('[System] Processo finalizado com segurança.');
      process.exit(0);
    } catch (err) {
      logger.error('[System] Erro ao encerrar recursos:', err);
      process.exit(1);
    }
  });

  // Força o encerramento após 10 segundos se não fechar naturalmente
  setTimeout(() => {
    logger.error('[System] Encerramento forçado devido ao timeout.');
    process.exit(1);
  }, 10000);
}

// Escuta sinais do sistema operacional
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Executa o Bootstrap
bootstrap();
