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
 * SOCKET.IO INIT (SAFE)
 */
try {
  socketServer.init(server);
  logger.info('[Socket.IO] Motor de tempo real inicializado com sucesso.');
} catch (error) {
  logger.error('[Socket.IO] Falha crítica:', error);
}

/**
 * CRON START
 */
cronService.start();
logger.info('[CronService] Tarefas activadas.');

/**
 * BOOTSTRAP SEGURO
 */
async function bootstrap() {
  const PORT = env.PORT || 5000;

  try {
    // DB CHECK (não mata servidor se falhar)
    try {
      await db.query('SELECT 1');
      logger.info('[Database] OK');
    } catch (err) {
      logger.warn('[Database] Offline mode:', err.message);
    }

    // REDIS CHECK (SAFE)
    try {
      if (cacheProvider?.client?.ping) {
        await cacheProvider.client.ping();
        logger.info('[Redis] OK');
      } else {
        logger.warn('[Redis] Modo memory (sem client)');
      }
    } catch (err) {
      logger.warn('[Redis] ping falhou (fallback ativo):', err.message);
    }

    // START SERVER (SEMPRE EXECUTA)
    server.listen(PORT, () => {
      logger.info(`
========================================================
🎮 OTAKU CLASH ANGOLA - BACKEND ONLINE
🌍 ENV: ${env.NODE_ENV}
📡 PORT: ${PORT}
========================================================
      `);
    });

  } catch (error) {
    logger.error('[Bootstrap] erro geral:', error);

    // ❌ NÃO usar process.exit aqui
    // o servidor ainda pode funcionar em modo degradado
  }
}

/**
 * GRACEFUL SHUTDOWN (MELHORADO)
 */
async function gracefulShutdown(signal) {
  logger.warn(`[System] ${signal} recebido`);

  server.close(async () => {
    try {
      await db.end();

      if (cacheProvider?.client?.quit) {
        await cacheProvider.client.quit();
      }

      logger.info('[System] encerrado com sucesso');
      process.exit(0);

    } catch (err) {
      logger.error('[Shutdown error]', err);
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.error('[System] forced shutdown');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('[UnhandledRejection]', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('[Fatal]', err);
});

bootstrap();
