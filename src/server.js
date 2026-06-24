const http = require('http');
const app = require('./app');
const env = require('./config/env');
const logger = require('./config/logger');
const db = require('./config/database');
const cacheProvider = require('./config/hybridRedis');
const socketServer = require('./socket/SocketServer');
const cronService = require('./services/cron/CronService');

const server = http.createServer(app);

/**
 * 🌐 SOCKET.IO INIT (SAFE & SECURED)
 */
try {
  socketServer.init(server);
  logger.info('[Socket.IO] Motor de tempo real inicializado com sucesso.');
} catch (error) {
  logger.error('[Socket.IO] Falha crítica na inicialização:', error);
}

/**
 * ⏰ CRON START
 */
cronService.start();
logger.info('[CronService] Orquestrador de tarefas activado.');

/**
 * ⚡ BOOTSTRAP SEGURO
 */
async function bootstrap() {
  const PORT = env.PORT || 5000;

  try {
    // 1. DATABASE CHECK (Fail-safe)
    try {
      await db.query('SELECT 1');
      logger.info('[Database] Conexão PostgreSQL OK');
    } catch (err) {
      logger.error('[Database] Erro de conexão inicial:', err.message);
      // Em modo degrade (Render), não matamos o processo imediatamente
    }

    // 2. REDIS / CACHE CHECK
    try {
      if (cacheProvider?.client?.ping) {
        const pong = await cacheProvider.client.ping();
        logger.info(`[Redis] Conexão OK (${pong})`);
      } else {
        logger.warn('[Redis] Operando em modo de memória local (Fallback)');
      }
    } catch (err) {
      logger.warn('[Redis] Offline. Fallback engine activo.');
    }

    // 3. LISTEN (Apenas após checks básicos)
    server.listen(PORT, () => {
      logger.info(`
========================================================
🎮 OTAKU CLASH ANGOLA - BACKEND ONLINE
🌍 ENV: ${env.NODE_ENV}
📡 PORT: ${PORT}
🚀 URL: ${env.API_URL}
========================================================
      `);
    });

  } catch (error) {
    logger.error('[Bootstrap] Erro fatal durante a subida do servidor:', error);
    process.exit(1);
  }
}

/**
 * 🛡️ GRACEFUL SHUTDOWN (CONTROLE DE SAÍDA)
 */
async function gracefulShutdown(signal) {
  logger.warn(`[System] Sinal ${signal} recebido. Iniciando encerramento seguro...`);

  server.close(async () => {
    try {
      await db.end();
      if (cacheProvider?.client?.quit) {
        await cacheProvider.client.quit();
      }
      logger.info('[System] Conexões fechadas. Backend offline com sucesso.');
      process.exit(0);
    } catch (err) {
      logger.error('[Shutdown] Erro ao fechar conexões:', err);
      process.exit(1);
    }
  });

  // Forçar encerramento após 10 segundos se as conexões estiverem presas
  setTimeout(() => {
    logger.error('[System] Shutdown forçado (Timeout de 10s atingido)');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error('[UnhandledRejection] Razão:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('[FatalException] Erro não tratado:', err);
  // Em casos de erro de memória ou sintaxe, é seguro fechar e deixar o Render reiniciar
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

bootstrap();
