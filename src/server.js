/**
 * ⚡ OTAKU CLASH ANGOLA - SERVER BOOTSTRAP (THE ENGINE)
 * Versão: 3.0.0 - Ultra Robust "Full-Full" Edition
 * Descrição: Ponto de entrada principal com gestão de ciclo de vida e resiliência de infraestrutura.
 */

const http = require('http');
const app = require('./app');
const env = require('./config/env');
const logger = require('./config/logger');
const db = require('./config/database');
const hybridRedis = require('./config/hybridRedis');
const socketServer = require('./socket/SocketServer');
const cronService = require('./services/cron/CronService');

/**
 * 🛠️ CRIAÇÃO DO SERVIDOR HTTP
 */
const server = http.createServer(app);

/**
 * 🛰️ INICIALIZAÇÃO DO SOCKET.IO (SAFE HANDSHAKE)
 * Vincula o motor de tempo real ao servidor HTTP com tratamento de erro isolado.
 */
try {
  socketServer.init(server);
  logger.info('🚀 [Socket.IO] Motor de tempo real operacional.');
} catch (error) {
  logger.error('🚨 [Socket.IO] Falha crítica na inicialização:', error);
  // O sistema continua, pois o Socket.IO possui lógica de fallback interna
}

/**
 * ⏰ INICIALIZAÇÃO DO CRON (BACKGROUND JOBS)
 */
try {
  cronService.start();
  logger.info('📅 [CronService] Agendador de tarefas em segundo plano activo.');
} catch (error) {
  logger.error('🚨 [CronService] Falha ao iniciar tarefas agendadas:', error);
}

/**
 * 🏗️ BOOTSTRAP INFALÍVEL (SAFE STARTUP)
 */
async function bootstrap() {
  const PORT = env.PORT || 5000;

  logger.info(`✨ [System] Iniciando boot em modo: ${env.NODE_ENV}`);

  try {
    // 1. Verificação de Banco de Dados (Não-bloqueante)
    // Se o banco falhar agora, o servidor ainda sobe para responder Health Checks
    db.query('SELECT 1')
      .then(() => logger.info('🐘 [PostgreSQL] Conexão validada com sucesso.'))
      .catch((err) => logger.warn(`⚠️ [PostgreSQL] Modo Offline detectado: ${err.message}`));

    // 2. Verificação de Redis (Híbrido)
    if (hybridRedis.enabled) {
      hybridRedis.client.ping()
        .then(() => logger.info('🔴 [Redis] Cache distribuído conectado.'))
        .catch((err) => logger.warn(`⚠️ [Redis] Fallback para memória activo: ${err.message}`));
    } else {
      logger.info('☁️ [Redis] Operando em modo de Memória Local (Fallback).');
    }

    /**
     * 🟢 START SERVER
     * O servidor escuta primeiro, garantindo que o Render/Cloud veja a porta aberta.
     */
    server.listen(PORT, () => {
      logger.info(`
========================================================
🛡️  OTAKU CLASH ANGOLA - BACKEND ONLINE
🌐  URL: ${env.API_URL || 'http://localhost:' + PORT}
🔌  PORTA: ${PORT}
🚀  STATUS: FULL ROBUST READY
========================================================
      `);
    });

  } catch (error) {
    logger.error('❌ [Fatal] Erro catastrófico no Bootstrap:', error);
    // Em caso de erro total que impeça o listen, aguardamos 5s e tentamos novamente
    setTimeout(bootstrap, 5000);
  }
}

/**
 * 🛑 GRACEFUL SHUTDOWN (ENCERRAMENTO SEGURO)
 * Garante que nenhuma transação seja cortada no meio durante o deploy.
 */
async function gracefulShutdown(signal) {
  logger.warn(`♻️ [System] ${signal} recebido. Iniciando encerramento seguro...`);

  // Define um timeout de segurança para forçar o encerramento se travar
  const forceExit = setTimeout(() => {
    logger.error('🚨 [System] Forçando encerramento (Timeout).');
    process.exit(1);
  }, 10000);

  server.close(async () => {
    try {
      // 1. Fecha pool de conexões do Banco
      await db.end();
      logger.info('🐘 [PostgreSQL] Pool de conexões encerrado.');

      // 2. Fecha conexões do Redis
      if (hybridRedis.client && typeof hybridRedis.client.quit === 'function') {
        await hybridRedis.client.quit();
        logger.info('🔴 [Redis] Conexão encerrada.');
      }

      clearTimeout(forceExit);
      logger.info('✅ [System] Encerramento concluído com sucesso. Tchau!');
      process.exit(0);

    } catch (err) {
      logger.error('❌ [System] Erro durante o encerramento:', err);
      process.exit(1);
    }
  });
}

/**
 * 🛡️ GESTÃO DE EXCEPÇÕES GLOBAIS
 * Impede que o processo morra por erros não tratados.
 */
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error('🚫 [UnhandledRejection] Promessa rejeitada não tratada:', {
    reason: reason?.message || reason,
    stack: reason?.stack
  });
});

process.on('uncaughtException', (err) => {
  logger.error('🔥 [Fatal] Erro crítico não capturado:', {
    message: err.message,
    stack: err.stack
  });
  // Em exceções fatais, tentamos um shutdown gracioso antes de morrer
  gracefulShutdown('UncaughtException');
});

// Lança o motor
bootstrap();
