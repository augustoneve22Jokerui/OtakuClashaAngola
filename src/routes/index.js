const express = require('express');
const { rateLimiterGlobal } = require('../middlewares/rateLimiter.middleware');
const { loggingMiddleware } = require('../middlewares/logging.middleware');
const AppError = require('../core/errors/AppError');
const db = require('../config/database');
const cacheProvider = require('../config/cache');

// Importação das rotas dos módulos (Conforme estrutura definida)
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

const router = express.Router();

/**
 * Middlewares Globais de Rota
 */
router.use(loggingMiddleware);
router.use(rateLimiterGlobal);

/**
 * Health Check Endpoint
 * Valida a saúde de toda a infraestrutura backend.
 */
router.get('/health', async (req, res) => {
  const healthStatus = {
    status: 'UP',
    timestamp: new Date().toISOString(),
    services: {
      database: 'DOWN',
      redis: 'DOWN',
      uptime: process.uptime()
    }
  };

  try {
    // Valida Database
    await db.query('SELECT 1');
    healthStatus.services.database = 'UP';
    
    // Valida Redis
    const redisPing = await cacheProvider.client.ping();
    if (redisPing === 'PONG') healthStatus.services.redis = 'UP';

    res.status(200).json(healthStatus);
  } catch (error) {
    healthStatus.status = 'PARTIALLY_DEGRADED';
    res.status(207).json(healthStatus);
  }
});

/**
 * Registro de Módulos da API (v1)
 */
const apiV1 = express.Router();

apiV1.use('/auth', authRoutes);
apiV1.use('/users', usersRoutes);
apiV1.use('/profiles', profilesRoutes);
apiV1.use('/animes', animesRoutes);
apiV1.use('/characters', charactersRoutes);
apiV1.use('/questions', questionsRoutes);
apiV1.use('/quiz', quizRoutes);
apiV1.use('/matches', matchesRoutes);
apiV1.use('/battle-royale', battleRoyaleRoutes);
apiV1.use('/tournaments', tournamentRoutes);
apiV1.use('/wallets', walletRoutes);
apiV1.use('/rankings', rankingsRoutes);
apiV1.use('/achievements', achievementsRoutes);
apiV1.use('/guilds', guildRoutes);
apiV1.use('/notifications', notificationRoutes);
apiV1.use('/admin', adminRoutes);

// Monta a v1 no roteador principal
router.use('/api/v1', apiV1);

/**
 * Fallback para rotas não encontradas
 */
router.all('*', (req, res, next) => {
  next(AppError.notFound(`Não foi possível encontrar ${req.originalUrl} neste servidor.`));
});

module.exports = router;
