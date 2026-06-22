const cron = require('node-cron');
const logger = require('../../config/logger');
const AnimeSyncService = require('../jikan/AnimeSyncService');
const CharacterSyncService = require('../jikan/CharacterSyncService');
const QuestionGeneratorService = require('../jikan/QuestionGeneratorService');
const cacheProvider = require('../../config/cache');

/**
 * CronService - Gerencia tarefas agendadas (Background Tasks).
 */
class CronService {
  constructor() {
    this.animeSync = new AnimeSyncService();
    this.charSync = new CharacterSyncService();
    this.questionGen = new QuestionGeneratorService();
  }

  /**
   * Inicializa todos os agendamentos da aplicação.
   */
  start() {
    logger.info('⏲️ Cron Service inicializado.');

    // 1. Sincronização de Animes da Temporada (Todos os dias às 03:00 AM)
    cron.schedule('0 3 * * *', async () => {
      logger.info('[CRON] Iniciando sincronização diária de animes...');
      try {
        await this.animeSync.syncSeasonAnimes();
        logger.info('[CRON] Sincronização diária de animes concluída.');
      } catch (error) {
        logger.error('[CRON] Erro na sincronização diária:', error);
      }
    });

    // 2. Sincronização de Personagens e Questões (Todos os domingos às 04:00 AM)
    cron.schedule('0 4 * * 0', async () => {
      logger.info('[CRON] Iniciando manutenção semanal (Personagens e Questões)...');
      try {
        // Sincroniza personagens de animes que ainda não possuem
        await this.charSync.syncPendingAnimesCharacters();
        
        // Busca animes recentes para gerar novas questões
        const { rows: recentAnimes } = await require('../../config/database').query(
          'SELECT id FROM public.animes ORDER BY created_at DESC LIMIT 10'
        );

        for (const anime of recentAnimes) {
          await this.questionGen.generateForAnime(anime.id);
        }

        logger.info('[CRON] Manutenção semanal concluída com sucesso.');
      } catch (error) {
        logger.error('[CRON] Erro na manutenção semanal:', error);
      }
    });

    // 3. Limpeza de Cache Temporário (A cada 6 horas)
    cron.schedule('0 */6 * * *', async () => {
      logger.info('[CRON] Iniciando limpeza periódica de cache...');
      try {
        const removed = await cacheProvider.delByPattern('temp:*');
        const matchmakingRemoved = await cacheProvider.delByPattern('matchmaking:*');
        logger.info(`[CRON] Limpeza de cache concluída. Chaves removidas: ${removed + matchmakingRemoved}`);
      } catch (error) {
        logger.error('[CRON] Erro na limpeza de cache:', error);
      }
    });

    // 4. Health Check de Presença (A cada 5 minutos)
    // Garante que não existam usuários "Online" se não houver conexão socket ativa
    cron.schedule('*/5 * * * *', async () => {
      try {
        const onlineUsers = await cacheProvider.client.smembers('presence:online_users');
        if (onlineUsers.length > 0) {
          logger.debug(`[CRON] Verificação de presença: ${onlineUsers.length} usuários online.`);
        }
      } catch (error) {
        logger.error('[CRON] Erro no health check de presença:', error);
      }
    });
  }
}

module.exports = new CronService();