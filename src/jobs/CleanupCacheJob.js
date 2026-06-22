const { Worker } = require('bullmq');
const { connection, QUEUES } = require('../config/bull');
const cacheProvider = require('../config/cache');
const logger = require('../config/logger');

/**
 * CleanupCacheJob - Worker responsável pela manutenção e limpeza do cache Redis.
 * Previne o inchaço da memória limpando chaves órfãs ou temporárias.
 */
const CleanupCacheWorker = new Worker(
  'cleanup-cache-queue', // Nome específico da fila de manutenção
  async (job) => {
    const { pattern, type } = job.data;

    logger.info(`[CleanupCacheJob] Iniciando faxina de cache. Tipo: ${type || 'GERAL'}`);

    try {
      let keysRemoved = 0;

      if (type === 'MATCHMAKING') {
        // Limpa estados de busca de partida que podem ter ficado travados
        keysRemoved = await cacheProvider.delByPattern('matchmaking:*');
      } else if (type === 'SESSIONS') {
        // Limpa metadados de sessões inativas
        keysRemoved = await cacheProvider.delByPattern('session:*');
      } else if (pattern) {
        // Limpeza baseada em padrão customizado enviado no job
        keysRemoved = await cacheProvider.delByPattern(pattern);
      } else {
        // Limpeza padrão de chaves temporárias genéricas
        keysRemoved = await cacheProvider.delByPattern('temp:*');
      }

      logger.info(`[CleanupCacheJob] Manutenção concluída. Chaves removidas: ${keysRemoved}`);

      return {
        status: 'success',
        keysRemoved,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`[CleanupCacheJob] Erro crítico durante a limpeza de cache:`, {
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  },
  {
    connection,
    // Prioridade baixa para não afetar o processamento de regras de negócio
    limiter: {
      max: 1,
      duration: 1000
    }
  }
);

/**
 * Handlers de Monitoramento
 */
CleanupCacheWorker.on('completed', (job, result) => {
  logger.info(`[CleanupCacheWorker] Job ${job.id} finalizado. Resultado: ${JSON.stringify(result)}`);
});

CleanupCacheWorker.on('failed', (job, err) => {
  logger.error(`[CleanupCacheWorker] Job ${job.id} falhou: ${err.message}`);
});

module.exports = CleanupCacheWorker;