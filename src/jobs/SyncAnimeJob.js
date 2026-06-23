const { Worker } = require('bullmq');
const { connection, QUEUES, workerSettings } = require('../config/bull');
const logger = require('../config/logger');
const AnimeSyncService = require('../services/jikan/AnimeSyncService');

/**
 * SyncAnimeJob - Worker responsável por processar a fila de sincronização de animes.
 * Este job interage com a API Jikan e atualiza o catálogo local.
 */
const SyncAnimeWorker = new Worker(
  QUEUES.SYNC_ANIME,
  async (job) => {
    const { animeId, type, bulk = false } = job.data;
    const syncService = new AnimeSyncService();

    logger.info(`[SyncAnimeJob] Iniciando processamento do job ${job.id}`, {
      animeId,
      type,
      bulk
    });

    try {
      if (bulk) {
        // Sincronização em massa (ex: top animes da temporada)
        await syncService.syncSeasonAnimes();
      } else if (animeId) {
        // Sincronização de um anime específico
        await syncService.syncSingleAnime(animeId);
      } else {
        throw new Error('Dados de job insuficientes: animeId ou flag bulk necessária.');
      }

      logger.info(`[SyncAnimeJob] Job ${job.id} finalizado com sucesso.`);
      
      return {
        status: 'completed',
        timestamp: new Date().toISOString(),
        processed: bulk ? 'multiple' : animeId
      };
    } catch (error) {
      logger.error(`[SyncAnimeJob] Falha no processamento do job ${job.id}`, {
        error: error.message,
        stack: error.stack
      });

      // Lançar o erro permite que o BullMQ utilize a política de retry definida no config
      throw error;
    }
  },
  {
    connection,
    concurrency: workerSettings.concurrency,
    lockDuration: workerSettings.lockDuration,
  }
);

/**
 * Handlers de eventos do Worker
 */
SyncAnimeWorker.on('completed', (job) => {
  logger.info(`[SyncAnimeWorker] Job ${job.id} concluído.`);
});

SyncAnimeWorker.on('failed', (job, err) => {
  logger.error(`[SyncAnimeWorker] Job ${job.id} falhou após ${job.attemptsMade} tentativas: ${err.message}`);
});

SyncAnimeWorker.on('error', (err) => {
  logger.error('[SyncAnimeWorker] Erro crítico no worker:', err);
});

module.exports = SyncAnimeWorker;