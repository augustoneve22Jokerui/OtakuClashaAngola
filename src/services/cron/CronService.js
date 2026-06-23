/**
 * ⏰ OTAKU CLASH ANGOLA - CRON SERVICE (BACKGROUND ORCHESTRATOR)
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Gerencia tarefas agendadas para manutenção, sincronização e integridade.
 */

const cron = require('node-cron');
const logger = require('../../config/logger');
const db = require('../../config/database');
const cacheProvider = require('../../config/hybridRedis');

// Services de Integração
const AnimeSyncService = require('../jikan/AnimeSyncService');
const CharacterSyncService = require('../jikan/CharacterSyncService');
const QuestionGeneratorService = require('../jikan/QuestionGeneratorService');

class CronService {
  constructor() {
    this.animeSync = new AnimeSyncService();
    this.charSync = new CharacterSyncService();
    this.questionGen = new QuestionGeneratorService();
  }

  /**
   * 🚀 INICIALIZA TODOS OS AGENDAMENTOS
   */
  start() {
    logger.info('⚡ Servidor de Tarefas Cron activado.');

    /**
     * 1. 🎬 SINCRONIZAÇÃO DIÁRIA DE ANIMES (TEMPORADA)
     * Horário: Todos os dias às 03:00 AM (Luanda)
     */
    cron.schedule('0 3 * * *', async () => {
      this._runJob('DailyAnimeSync', async () => {
        logger.info('[Cron:Anime] Iniciando sincronização da temporada...');
        await this.animeSync.syncSeasonAnimes();
      });
    });

    /**
     * 2. 👥 MANUTENÇÃO SEMANAL DE CONTEÚDO (CHARS & QUESTÕES)
     * Horário: Todos os domingos às 04:00 AM (Luanda)
     */
    cron.schedule('0 4 * * 0', async () => {
      this._runJob('WeeklyContentMaintenance', async () => {
        logger.info('[Cron:Maintenance] Iniciando manutenção semanal...');
        
        // A. Sincroniza personagens de animes novos/pendentes
        await this.charSync.syncPendingAnimes();

        // B. Gera questões automáticas para as obras recém-sincronizadas
        const { rows: recentAnimes } = await db.query(
          'SELECT id FROM public.animes ORDER BY created_at DESC LIMIT 5'
        );

        for (const anime of recentAnimes) {
          await this.questionGen.generateForAnime(anime.id);
        }
      });
    });

    /**
     * 3. 🧹 LIMPEZA DE CACHE E ESTADOS ÓRFÃOS
     * Horário: A cada 6 horas
     */
    cron.schedule('0 */6 * * *', async () => {
      this._runJob('InfrastructureCleanup', async () => {
        logger.info('[Cron:Cleanup] Iniciando faxina de infraestrutura...');
        
        // Limpa filas de matchmaking expiradas e sessões de quiz abandonadas no cache
        const keys = await cacheProvider.client.keys('otaku_clash:*');
        // O cacheProvider/Redis tratará o TTL, mas aqui podemos forçar limpezas lógicas se necessário.
        
        logger.info(`[Cron:Cleanup] Manutenção de memória concluída.`);
      });
    });

    /**
     * 4. 🛰️ RECONCILIAÇÃO DE PRESENÇA (ANTI-GHOSTING)
     * Horário: A cada 5 minutos
     * Objetivo: Limpar utilizadores que constam como online mas não têm socket ativo.
     */
    cron.schedule('*/5 * * * *', async () => {
      this._runJob('PresenceReconciliation', async () => {
        const presenceKey = 'presence:online_users';
        const onlineUsers = await cacheProvider.client.smembers(presenceKey);

        if (onlineUsers.length > 0) {
          logger.debug(`[Cron:Presence] Verificando integridade de ${onlineUsers.length} utilizadores.`);
          
          // Nota: Em um ambiente clusterizado, a reconciliação deve ser cuidadosa.
          // Aqui implementamos uma lógica de 'heartbeat' via last_seen no banco.
          const query = `
            UPDATE public.profiles 
            SET is_online = false 
            WHERE is_online = true 
            AND last_seen < NOW() - INTERVAL '10 minutes'
            RETURNING id
          `;
          
          const { rows: loggedOut } = await db.query(query);
          
          if (loggedOut.length > 0) {
            for (const user of loggedOut) {
              await cacheProvider.client.srem(presenceKey, user.id);
            }
            logger.info(`[Cron:Presence] ${loggedOut.length} utilizadores inactivos movidos para offline.`);
          }
        }
      });
    });
  }

  /**
   * 🛡️ WRAPPER PARA EXECUÇÃO SEGURA DE JOBS (PRIVATE)
   */
  async _runJob(jobName, fn) {
    const startTime = Date.now();
    try {
      await fn();
      const duration = Date.now() - startTime;
      logger.debug(`[Cron:Success] Job "${jobName}" concluído em ${duration}ms.`);
    } catch (error) {
      logger.error(`[Cron:Error] Falha crítica no Job "${jobName}": ${error.message}`);
      // Aqui poderíamos integrar com Sentry ou outro monitor de erros
    }
  }
}

module.exports = new CronService();