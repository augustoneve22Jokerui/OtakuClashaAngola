const env = require('./env');
const logger = require('./logger');

/**
 * Configuração de conexão com Redis para o BullMQ
 */
const connection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  db: env.REDIS_DB || 0,
};

/**
 * Opções padrão para todos os Jobs (Tarefas)
 */
const defaultJobOptions = {
  // Tenta novamente em caso de falha
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000, // Começa com 5 segundos
  },
  // Limpeza automática para economizar memória no Redis
  removeOnComplete: {
    age: 3600, // Mantém histórico por 1 hora
    count: 100, // Ou os últimos 100 jobs
  },
  removeOnFail: {
    age: 24 * 3600, // Mantém falhas por 24 horas para debugging
  },
};

/**
 * Definição centralizada dos nomes das filas da aplicação
 */
const QUEUES = {
  SYNC_ANIME: 'sync-anime-queue',
  SYNC_CHARACTER: 'sync-character-queue',
  NOTIFICATIONS: 'notifications-queue',
  GENERATE_QUESTIONS: 'generate-questions-queue',
  MATCH_CLEANUP: 'match-cleanup-queue',
  WALLET_TRANSACTIONS: 'wallet-transactions-queue',
};

/**
 * Objeto de configuração exportado
 */
const bullConfig = {
  connection,
  defaultJobOptions,
  QUEUES,
  // Configuração para o Worker do BullMQ
  workerSettings: {
    concurrency: 5, // Processa 5 jobs simultaneamente por worker
    lockDuration: 30000, // 30 segundos
  }
};

/**
 * Monitoramento global de eventos das filas (opcional para debug)
 */
const setupQueueEvents = (queueName, queueEvents) => {
  queueEvents.on('completed', ({ jobId }) => {
    logger.info(`[Queue: ${queueName}] Job ${jobId} completed successfully.`);
  });

  queueEvents.on('failed', ({ jobId, failedReason }) => {
    logger.error(`[Queue: ${queueName}] Job ${jobId} failed. Reason: ${failedReason}`);
  });
};

module.exports = {
  ...bullConfig,
  setupQueueEvents
};