/**
 * ==========================================
 * OTAKU CLASH ANGOLA - CRON SERVICE
 * Enterprise Hybrid Safe Edition
 * ==========================================
 */

const cron = require('node-cron');
const logger = require('../../config/logger');
const db = require('../../config/database');
const cacheProvider = require('../../config/hybridRedis');

const AnimeSyncService = require('../jikan/AnimeSyncService');
const CharacterSyncService = require('../jikan/CharacterSyncService');
const QuestionGeneratorService = require('../jikan/QuestionGeneratorService');

class CronService {

    constructor() {
        this.started = false;

        try {
            this.animeSync = new AnimeSyncService();
        } catch {
            this.animeSync = null;
        }

        try {
            this.charSync = new CharacterSyncService();
        } catch {
            this.charSync = null;
        }

        try {
            this.questionGen = new QuestionGeneratorService();
        } catch {
            this.questionGen = null;
        }
    }

    /**
     * ==========================================
     * START
     * ==========================================
     */
    start() {

        if (this.started) {
            return;
        }

        this.started = true;

        logger.info('⏰ Cron Service inicializado.');

        /**
         * ==========================================
         * DAILY ANIME SYNC
         * ==========================================
         */
        cron.schedule('0 3 * * *', async () => {

            await this._runJob(
                'DailyAnimeSync',
                async () => {

                    if (!this.animeSync) {
                        return;
                    }

                    logger.info(
                        '[Cron:Anime] Sincronização iniciada.'
                    );

                    await this.animeSync.syncSeasonAnimes();
                }
            );

        });

        /**
         * ==========================================
         * WEEKLY MAINTENANCE
         * ==========================================
         */
        cron.schedule('0 4 * * 0', async () => {

            await this._runJob(
                'WeeklyContentMaintenance',
                async () => {

                    logger.info(
                        '[Cron] Manutenção semanal iniciada.'
                    );

                    if (
                        this.charSync &&
                        typeof this.charSync.syncPendingAnimes === 'function'
                    ) {
                        await this.charSync.syncPendingAnimes();
                    }

                    if (
                        !this.questionGen ||
                        typeof db.query !== 'function'
                    ) {
                        return;
                    }

                    let recentAnimes = [];

                    try {

                        const result = await db.query(`
                            SELECT id
                            FROM public.animes
                            ORDER BY created_at DESC
                            LIMIT 5
                        `);

                        recentAnimes = result.rows || [];

                    } catch (err) {

                        logger.warn(
                            '[Cron] Banco indisponível durante manutenção semanal.'
                        );

                        return;
                    }

                    for (const anime of recentAnimes) {

                        try {

                            await this.questionGen.generateForAnime(
                                anime.id
                            );

                        } catch (err) {

                            logger.warn(
                                `[Cron] Falha ao gerar questões para anime ${anime.id}`
                            );

                        }

                    }

                }
            );

        });

        /**
         * ==========================================
         * INFRASTRUCTURE CLEANUP
         * ==========================================
         */
        cron.schedule('0 */6 * * *', async () => {

            await this._runJob(
                'InfrastructureCleanup',
                async () => {

                    logger.info(
                        '[Cron] Limpeza de infraestrutura.'
                    );

                    const client = cacheProvider?.client;

                    if (
                        !cacheProvider?.enabled ||
                        !client
                    ) {
                        return;
                    }

                    try {

                        if (typeof client.del === 'function') {

                            await client.del(
                                'otaku_clash:leaderboard:global'
                            );

                        }

                    } catch (err) {

                        logger.warn(
                            '[Cron] Falha na limpeza do cache.'
                        );

                    }

                }
            );

        });

        /**
         * ==========================================
         * SESSION CLEANUP
         * ==========================================
         */
        cron.schedule('0 * * * *', async () => {

            await this._runJob(
                'SessionCleanup',
                async () => {

                    if (typeof db.query !== 'function') {
                        return;
                    }

                    try {

                        await db.query(`
                            UPDATE public.matches
                            SET
                                status='FINISHED',
                                ended_at=NOW()
                            WHERE
                                status='WAITING'
                                AND created_at <
                                NOW() - INTERVAL '2 hours'
                        `);

                    } catch (err) {

                        logger.warn(
                            '[Cron] Session cleanup ignorado.'
                        );

                    }

                }
            );

        });

        /**
         * ==========================================
         * PRESENCE RECONCILIATION
         * ==========================================
         */
        cron.schedule('*/5 * * * *', async () => {

            await this._runJob(
                'PresenceReconciliation',
                async () => {

                    const client = cacheProvider?.client;

                    if (
                        !cacheProvider?.enabled ||
                        !client
                    ) {
                        return;
                    }

                    if (
                        typeof client.smembers !== 'function'
                    ) {
                        return;
                    }

                    try {

                        const onlineUsers =
                            await client.smembers(
                                'presence:online_users'
                            );

                        if (
                            !onlineUsers ||
                            onlineUsers.length === 0
                        ) {
                            return;
                        }

                        if (
                            typeof db.query !== 'function'
                        ) {
                            return;
                        }

                        const result = await db.query(`
                            UPDATE public.profiles
                            SET is_online = false
                            WHERE
                                is_online = true
                                AND last_seen <
                                NOW() - INTERVAL '10 minutes'
                            RETURNING id
                        `);

                        const users =
                            result.rows || [];

                        if (
                            typeof client.srem === 'function'
                        ) {

                            for (const user of users) {

                                await client.srem(
                                    'presence:online_users',
                                    user.id
                                );

                            }

                        }

                        if (users.length > 0) {

                            logger.info(
                                `[Cron] ${users.length} utilizadores removidos da presença.`
                            );

                        }

                    } catch (err) {

                        logger.warn(
                            '[Cron] Presence reconciliation ignorada.'
                        );

                    }

                }
            );

        });

        logger.info(
            '✅ Cron Service carregado com sucesso.'
        );
    }

    /**
     * ==========================================
     * SAFE JOB WRAPPER
     * ==========================================
     */
    async _runJob(jobName, fn) {

        const start = Date.now();

        try {

            logger.info(
                `[Job] ${jobName} iniciado`
            );

            await fn();

            logger.info(
                `[Job] ${jobName} concluído em ${
                    Date.now() - start
                }ms`
            );

        } catch (error) {

            logger.error(
                `[Job] ${jobName} falhou`,
                {
                    message: error.message,
                    stack: error.stack
                }
            );

        }

    }

}

module.exports = new CronService();
