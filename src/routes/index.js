/**
 * 🚀 OTAKU CLASH ANGOLA - API ROUTER
 * Versão: 2.1.4 - Clean Route Mounting & Enterprise Path Matching Edition
 * Descrição: Orquestrador central de rotas da API. Responsável por Health Checks híbridos,
 *            versionamento sem colisões, mapeamento de metadados e Fallback Global.
 */

const express = require('express');
const { rateLimiterGlobal } = require('../middlewares/rateLimiter.middleware');
const { loggingMiddleware } = require('../middlewares/logging.middleware');
const AppError = require('../core/errors/AppError');
const db = require('../config/database');
const cacheProvider = require('../config/cache');

// Importação rigorosa de todos os sub-módulos do ecossistema
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
 * ============================================================
 * MIDDLEWARES GLOBAIS DE INFRAESTRUTURA
 * ============================================================
 */
router.use(loggingMiddleware);
router.use(rateLimiterGlobal);

/**
 * ============================================================
 * HEALTH CHECK ENTERPRISE (ROTA DE TELEMETRIA DO PROXY/RENDER)
 * Separada e posicionada estrategicamente no topo para evitar limitação de requisições ou latência.
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
    // 1. Validação ativa do Banco de Dados (Frankfurt Pooler)
    await db.query('SELECT 1');
    healthStatus.services.database = 'UP';

    // 2. Validação complexa de estado do Cache do ecossistema (Redis vs Local Memory)
    try {
      if (
        cacheProvider &&
        typeof cacheProvider.isRedis === 'function' && 
        cacheProvider.isRedis()
      ) {
        if (cacheProvider.client && typeof cacheProvider.client.ping === 'function') {
          const pong = await cacheProvider.client.ping();
          healthStatus.services.redis = pong === 'PONG' ? 'UP' : 'DEGRADED';
        } else {
          healthStatus.services.redis = 'UP';
        }
      } else if (cacheProvider && typeof cacheProvider.isRedis === 'function') {
        healthStatus.services.redis = 'MEMORY_MODE';
      } else if (cacheProvider && cacheProvider.client && typeof cacheProvider.client.ping === 'function') {
        const pong = await cacheProvider.client.ping();
        healthStatus.services.redis = pong === 'PONG' ? 'UP' : 'DEGRADED';
      } else {
        healthStatus.services.redis = 'MEMORY_MODE';
      }
    } catch (redisError) {
      healthStatus.services.redis = 'DEGRADED';
    }

    return res.status(200).json(healthStatus);

  } catch (error) {
    healthStatus.status = 'PARTIALLY_DEGRADED';
    return res.status(207).json({
      ...healthStatus,
      error: error.message
    });
  }
});

/**
 * ============================================================
 * SUB-ROTEADOR V1 - DEFINIÇÃO E REGISTRO DE MÓDULOS
 * ============================================================
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

/**
 * ============================================================
 * METADADOS E MAPA DE ENDPOINTS DA API V1
 * Evita colisões ocultas de roteamento ao expor explicitamente as rotas mapeadas.
 * ============================================================
 */
apiV1.get('/', (req, res) => {
  return res.status(200).json({
    success: true,
    api: 'Otaku Clash Angola',
    version: '2.1.4',
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
 * MONTAGEM FINAL DO SUB-ROTEADOR V1 NO PREFIXO GLOBAL DA API
 */
router.use('/api/v1', apiV1);

/**
 * ============================================================
 * LANDING PAGE API (RAIZ DO SERVIDOR)
 * ============================================================
 */
router.get('/', (req, res) => {
  return res.status(200).json({
    success: true,
    name: 'Otaku Clash Angola API',
    version: '2.1.4',
    status: 'ONLINE',
    message: 'Bem-vindo ao núcleo competitivo de elite.',
    timestamp: new Date().toISOString()
  });
});

/**
 * ============================================================
 * 404 FALLBACK GLOBAL (ANTI-COLISÃO)
 * Mantido estritamente na última posição para capturar requisições fora do escopo v1.
 * ============================================================
 */
router.all('*', (req, res, next) => {
  next(
    AppError.notFound(
      `Caminho ${req.originalUrl} não localizado neste servidor.`
    )
  );
});

module.exports = router;
