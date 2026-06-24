/**
 * ⚡ OTAKU CLASH ANGOLA - SERVER BOOTSTRAP (THE ENGINE)
 * Versão: 3.5.0 - Final Operational Logic & Ultra Robust "Full-Full" Edition
 * Descrição: Ponto de entrada principal com abertura imediata de porta anti-timeout do Render,
 *            validação assíncrona de banco via Frankfurt Pooler com recuo dinâmico de 10s e proteção anti-crash.
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
 * 🏗️ BOOTSTRAP ASSÍNCRONO INTELIGENTE (ANTI-TIMEOUT ENGINE)
 * Inicializa a porta HTTP imediatamente para satisfazer o proxy reverso (Render/Heroku)
 * e aciona os serviços de infraestrutura crítica em background de forma ultra-resiliente.
 */
async function bootstrap() {
  const PORT = env.PORT || 5000;

  logger.info(`✨ [System] Iniciando boot do servidor em modo: ${env.NODE_ENV}`);

  /**
   * 🟢 1. INICIALIZAÇÃO IMEDIATA DA PORTA (ANTI-TIMEOUT SHIELD)
   * Evita que o Render derrube a aplicação por demorar a responder ao bind da porta.
   */
  server.listen(PORT, () => {
    logger.info(`
========================================================
🛡️  OTAKU CLASH ANGOLA - BACKEND ONLINE
🌐  URL: ${env.API_URL || 'http://localhost:' + PORT}
🔌  PORTA: ${PORT}
🚀  STATUS: FULL OPERATIONAL
========================================================
    `);
  });

  /**
   * 🛰️ 2. STARTUP DOS MÓDULOS CORE EM SEGUNDO PLANO
   */
  try {
    socketServer.init(server);
    logger.info('🚀 [Socket.IO] Motores de tempo real ativos e operacionais.');
  } catch (error) {
    logger.error('⚠️ [Services] Falha parcial na inicialização do Socket:', error.message);
  }

  try {
    cronService.start();
    logger.info('📅 [CronService] Agendador de tarefas em segundo plano ativo.');
  } catch (error) {
    logger.error('⚠️ [Services] Falha parcial na inicialização do Cron:', error.message);
  }

  /**
   * ☁️ 3. VERIFICAÇÃO DE REDIS (HÍBRIDO)
   */
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
   * 🐘 4. LOOP DE CONEXÃO COM O BANCO DE DADOS (RETRY INFINITO)
   * O loop impede travamento do servidor e tenta reconexão contínua em falhas de rede.
   */
  let connected = false;
  while (!connected) {
    try {
      logger.info('🐘 [Database] Validando conexão com PostgreSQL...');
      await db.query('SELECT 1');
      connected = true;
      logger.info('✅ [PostgreSQL] Banco de dados pronto para transações.');
    } catch (error) {
      const errorMsg = error.message || '';

      // 🛡️ Intelligent Boot Shield: Detecta erros fatais de credenciais/região/tenant do Supabase
      if (errorMsg.includes('tenant') || errorMsg.includes('not found') || errorMsg.includes('authentication')) {
        logger.error('💥 [Fatal] ERRO DE CONFIGURAÇÃO CRÍTICO: A DATABASE_URL está incorreta para esta região do Supabase.');
        logger.info('👉 Verifique a região no host (ex: aws-0-sa-east-1) e o usuário (postgres.ref) nas variáveis de ambiente.');
        
        // Encerra imediatamente o processo para evitar overload e loops infinitos no proxy
        process.exit(1);
      } else {
        // Falhas normais de timeout ou oscilação de rede de Frankfurt: Aguarda 10s e reavalia
        logger.error('❌ [Database] Falha ao conectar. Verifique as credenciais no DATABASE_URL.');
        logger.info(`🐘 [Database] Detalhe do erro: ${errorMsg}`);
        logger.info('🐘 [Database] Tentando reconectar em 10 segundos...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
  }
}

/**
 * 🛑 GRACEFUL SHUTDOWN (ENCERRAMENTO SEGURO)
 * Evita a corrupção de transações ativas durante ciclos de CI/CD ou redeployments.
 */
async function gracefulShutdown(signal) {
  logger.warn(`⚠️ [System] ${signal} recebido. Finalizando processos...`);

  // Define um timeout de segurança limite (Deadman Switch) para forçar a saída caso o pool trave
  const forceExit = setTimeout(() => {
    logger.error('🚨 [System] Forçando encerramento imediato via process.exit devido a travamento no desmonte (Timeout 10s).');
    process.exit(1);
  }, 10000);

  server.close(async () => {
    try {
      // 1. Fecha pool de conexões do PostgreSQL de forma limpa
      await db.end();
      logger.info('🐘 [PostgreSQL] Pool de conexões encerrado de forma limpa.');

      // 2. Fecha conexões do barramento Redis
      if (hybridRedis && hybridRedis.client && typeof hybridRedis.client.quit === 'function') {
        await hybridRedis.client.quit();
        logger.info('🔴 [Redis] Conexão de cache distribuído encerrada.');
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
 * 🛡️ GESTÃO DE EXCEÇÕES GLOBAIS (ANTI-CRASH GUARDIAN)
 * Intercepta falhas da thread principal prevenindo que erros assíncronos quebrem a API.
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
  // Tenta realizar um desligamento gracioso para liberar recursos alocados antes do encerramento forçado
  gracefulShutdown('UncaughtException');
});

// Lança o motor completo de execução do servidor
bootstrap();
