/**
 * ⚡ OTAKU CLASH ANGOLA - SERVER BOOTSTRAP (THE ENGINE)
 * Versão: 3.2.0 - Direct Database Validation & Ultra Robust "Full-Full" Edition
 * Descrição: Ponto de entrada principal com validação de banco por IPv4 Pooler, 
 *            gestão de ciclo de vida e resiliência de infraestrutura crítica.
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
 * Realiza validações críticas de rede e infraestrutura antes de abrir a porta da aplicação.
 */
async function bootstrap() {
  const PORT = env.PORT || 5000;

  logger.info(`✨ [System] Iniciando boot do servidor em modo: ${env.NODE_ENV}`);

  try {
    // 1. Validação OBRIGATÓRIA do Banco de Dados antes de abrir a porta
    logger.info('🐘 [System] Validando conexão com PostgreSQL...');
    await db.query('SELECT NOW()');
    logger.info('✅ [PostgreSQL] Banco de dados conectado via IPv4 Pooler.');

    // 2. Verificação de Redis (Híbrido)
    if (hybridRedis && hybridRedis.enabled) {
      try {
        await hybridRedis.client.ping();
        logger.info('🔴 [Redis] Cache distribuído conectado e operacional.');
      } catch (err) {
        logger.warn(`⚠️ [Redis] Falha no ping. Fallback para memória activo: ${err.message}`);
      }
    } else {
      logger.info('☁️ [Redis] Operando em modo de Memória Local (Fallback de Infraestrutura).');
    }

    /**
     * 🟢 START SERVER
     * O servidor passa a escutar chamadas, sinalizando sucesso ao proxy (Render/Heroku).
     */
    server.listen(PORT, () => {
      logger.info(`
========================================================
🛡️  OTAKU CLASH ANGOLA - BACKEND ONLINE
🌐  URL: ${env.API_URL || 'http://localhost:' + PORT}
🔌  PORTA: ${PORT}
🚀  STATUS: FULL OPERATIONAL READY
========================================================
      `);
    });

  } catch (error) {
    logger.error('💥 [Fatal] Erro catastrófico no Bootstrap:', error.message);
    
    // Em produção ou falha de infraestrutura, tenta nova reconexão em 5 segundos
    logger.info('🐘 [System] Tentando restabelecer e reiniciar bootstrap em 5s...');
    setTimeout(bootstrap, 5000);
  }
}

/**
 * 🛑 GRACEFUL SHUTDOWN (ENCERRAMENTO SEGURO)
 * Garante que nenhuma transação seja corrompida no meio de uma operação durante deploys.
 */
async function gracefulShutdown(signal) {
  logger.warn(`♻️ [System] ${signal} recebido. Iniciando encerramento seguro...`);

  // Define um timeout de segurança (Deadman Switch) para forçar o encerramento se travar
  const forceExit = setTimeout(() => {
    logger.error('🚨 [System] Forçando encerramento imediato via process.exit devido a travamento (Timeout 10s).');
    process.exit(1);
  }, 10000);

  server.close(async () => {
    try {
      // 1. Fecha pool de conexões do Banco de Dados
      await db.end();
      logger.info('🐘 [PostgreSQL] Pool de conexões encerrado de forma limpa.');

      // 2. Fecha conexões do Redis
      if (hybridRedis && hybridRedis.client && typeof hybridRedis.client.quit === 'function') {
        await hybridRedis.client.quit();
        logger.info('🔴 [Redis] Conexão de cache encerrada.');
      }

      clearTimeout(forceExit);
      logger.info('✅ [System] Encerramento de processos concluído com sucesso.');
      process.exit(0);

    } catch (err) {
      logger.error('❌ [System] Erro crítico durante as rotinas de encerramento:', err);
      process.exit(1);
    }
  });
}

/**
 * 🛡️ GESTÃO DE EXCEPÇÕES GLOBAIS (ANTI-CRASH GUARDIAN)
 * Impede a terminação abrupta da aplicação por rejeições ou erros não capturados diretamente.
 */
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error('🚫 [UnhandledRejection] Promessa rejeitada não tratada capturada:', {
    reason: reason?.message || reason,
    stack: reason?.stack
  });
});

process.on('uncaughtException', (err) => {
  logger.error('🔥 [Fatal] Erro crítico absoluto não capturado na thread principal:', {
    message: err.message,
    stack: err.stack
  });
  // Tenta realizar um desligamento gracioso para liberar recursos e pools pendentes antes de morrer
  gracefulShutdown('UncaughtException');
});

// Lança o motor do servidor
bootstrap();
