/**

* 🛡️ OTAKU CLASH ANGOLA - API ROUTER
* Versão: 2.1.1 - Enterprise Production Ready
* Descrição:
* Orquestrador central de rotas da API.
* Responsável por:
* * Landing Page
* * Health Check
* * Versionamento
* * Registro de Módulos
* * Fallback Global
    */

const express = require('express');

const { rateLimiterGlobal } = require('../middlewares/rateLimiter.middleware');
const { loggingMiddleware } = require('../middlewares/logging.middleware');

const AppError = require('../core/errors/AppError');

const db = require('../config/database');
const cacheProvider = require('../config/cache');

const router = express.Router();

/**

* ============================================================
* MIDDLEWARES GLOBAIS
* ============================================================
  */

router.use(loggingMiddleware);
router.use(rateLimiterGlobal);

/**

* ============================================================
* IMPORTAÇÃO DOS MÓDULOS
* ============================================================
  */

const authRoutes = require('../modules/auth/auth.routes');
const usersRoutes = require('../modules/users/users.routes');
const profilesRoutes = require('../modules/profiles/profiles.routes');
const animesRoutes = require('../modules/animes/animes.routes');
const charactersRoutes = require('../modules/characters/characters.routes');
const questionsRoutes = require('../modules/questions/questions.routes');
const quizRoutes = require('../modules/quiz/quiz.routes');
const matchesRoutes = require('../modules/matches/matches.routes');
const walletRoutes = require('../modules/wallets/wallets.routes');
const rankingsRoutes = require('../modules/rankings/rankings.routes');
const achievementsRoutes = require('../modules/achievements/achievements.routes');
const guildRoutes = require('../modules/guilds/guilds.routes');
const notificationRoutes = require('../modules/notifications/notifications.routes');
const battleRoyaleRoutes = require('../modules/battleRoyale/battleRoyale.routes');
const tournamentRoutes = require('../modules/tournaments/tournaments.routes');
const adminRoutes = require('../modules/admin/admin.routes');

/**

* ============================================================
* LANDING PAGE
* ============================================================
  */

router.get('/', (req, res) => {
return res.status(200).json({
success: true,
service: 'Otaku Clash Angola API',
version: '2.1.1',
environment: process.env.NODE_ENV || 'development',
status: 'ONLINE',
timestamp: new Date().toISOString()
});
});

/**

* ============================================================
* HEALTH CHECK
* ============================================================
  */

router.get('/health', async (req, res) => {

const healthStatus = {
status: 'UP',
timestamp: new Date().toISOString(),
uptime: process.uptime(),
services: {
database: 'DOWN',
redis: 'DOWN'
}
};

try {

```
await db.query('SELECT 1');
healthStatus.services.database = 'UP';

try {

  if (
    cacheProvider &&
    cacheProvider.client &&
    typeof cacheProvider.client.ping === 'function'
  ) {

    const pong = await cacheProvider.client.ping();

    healthStatus.services.redis =
      pong === 'PONG'
        ? 'UP'
        : 'DEGRADED';

  } else {

    healthStatus.services.redis = 'MEMORY_MODE';

  }

} catch (redisError) {

  healthStatus.services.redis = 'DEGRADED';

}

return res.status(200).json(healthStatus);
```

} catch (error) {

```
return res.status(207).json({
  ...healthStatus,
  status: 'PARTIALLY_DEGRADED',
  error: error.message
});
```

}

});

/**

* ============================================================
* API V1
* ============================================================
  */

const apiV1 = express.Router();

/**

* AUTH
  */
  apiV1.use('/auth', authRoutes);

/**

* USERS
  */
  apiV1.use('/users', usersRoutes);

/**

* PROFILES
  */
  apiV1.use('/profiles', profilesRoutes);

/**

* ANIMES
  */
  apiV1.use('/animes', animesRoutes);

/**

* CHARACTERS
  */
  apiV1.use('/characters', charactersRoutes);

/**

* QUESTIONS
  */
  apiV1.use('/questions', questionsRoutes);

/**

* QUIZ
  */
  apiV1.use('/quiz', quizRoutes);

/**

* MATCHES
  */
  apiV1.use('/matches', matchesRoutes);

/**

* BATTLE ROYALE
  */
  apiV1.use('/battle-royale', battleRoyaleRoutes);

/**

* TOURNAMENTS
  */
  apiV1.use('/tournaments', tournamentRoutes);

/**

* WALLETS
  */
  apiV1.use('/wallets', walletRoutes);

/**

* RANKINGS
  */
  apiV1.use('/rankings', rankingsRoutes);

/**

* ACHIEVEMENTS
  */
  apiV1.use('/achievements', achievementsRoutes);

/**

* GUILDS
  */
  apiV1.use('/guilds', guildRoutes);

/**

* NOTIFICATIONS
  */
  apiV1.use('/notifications', notificationRoutes);

/**

* ADMIN
  */
  apiV1.use('/admin', adminRoutes);

/**

* ============================================================
* MOUNT API V1
* ============================================================
  */

router.use('/api/v1', apiV1);

/**

* ============================================================
* API INFO
* ============================================================
  */

router.get('/api/v1', (req, res) => {

return res.status(200).json({
success: true,
api: 'Otaku Clash Angola',
version: 'v1',
status: 'ONLINE',
endpoints: {
auth: '/api/v1/auth',
users: '/api/v1/users',
profiles: '/api/v1/profiles',
animes: '/api/v1/animes',
characters: '/api/v1/characters',
questions: '/api/v1/questions',
quiz: '/api/v1/quiz',
matches: '/api/v1/matches',
battleRoyale: '/api/v1/battle-royale',
tournaments: '/api/v1/tournaments',
wallets: '/api/v1/wallets',
rankings: '/api/v1/rankings',
achievements: '/api/v1/achievements',
guilds: '/api/v1/guilds',
notifications: '/api/v1/notifications',
admin: '/api/v1/admin'
}
});

});

/**

* ============================================================
* 404 GLOBAL
* ============================================================
  */

router.all('*', (req, res, next) => {

next(
AppError.notFound(
`Não foi possível encontrar ${req.originalUrl} neste servidor.`
)
);

});

/**

* ============================================================
* EXPORT
* ============================================================
  */

module.exports = router;
