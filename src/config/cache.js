const Redis = require('ioredis');
const env = require('./env');
const logger = require('./logger');

const memoryCache = new Map();

let redis = null;
let redisReady = false;

/**
 * ==================================================
 * CHECK SE REDIS REALMENTE EXISTE
 * ==================================================
 */
const shouldUseRedis =
  env.REDIS_ENABLED === 'true' &&
  env.REDIS_HOST &&
  env.REDIS_HOST !== '127.0.0.1';

/**
 * ==================================================
 * INICIALIZAÇÃO SEGURA (NUNCA CRASHA)
 * ==================================================
 */
if (shouldUseRedis) {
  try {
    redis = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
      db: env.REDIS_DB || 0,
      keyPrefix: 'otaku_clash:',

      retryStrategy() {
        return null; // 👈 PARA DE TENTAR (EVITA CRASH)
      },

      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    });

    redis.on('connect', () => {
      redisReady = true;
      logger.info('🚀 Redis conectado');
    });

    redis.on('error', (err) => {
      redisReady = false;
      logger.warn(`[Redis] fallback memory: ${err.message}`);
    });

  } catch (err) {
    logger.warn(`[Redis] desativado: ${err.message}`);
    redis = null;
  }
} else {
  logger.warn('[Redis] modo MEMORY ONLY (seguro)');
}

/**
 * ==================================================
 * CACHE HÍBRIDO SEGURO
 * ==================================================
 */
const cacheProvider = {
  client: redis,

  isRedis: () => redisReady && redis,

  async set(key, value, ttl = 3600) {
    const data = JSON.stringify(value);

    if (this.isRedis()) {
      try {
        return await redis.set(key, data, 'EX', ttl);
      } catch {
        // fallback automático
      }
    }

    memoryCache.set(key, {
      value: data,
      expire: Date.now() + ttl * 1000,
    });

    return true;
  },

  async get(key) {
    if (this.isRedis()) {
      try {
        const data = await redis.get(key);
        if (data) return JSON.parse(data);
      } catch {}
    }

    const mem = memoryCache.get(key);
    if (!mem) return null;

    if (Date.now() > mem.expire) {
      memoryCache.delete(key);
      return null;
    }

    return JSON.parse(mem.value);
  },

  async del(key) {
    if (this.isRedis()) {
      try {
        return await redis.del(key);
      } catch {}
    }

    return memoryCache.delete(key);
  }
};

module.exports = cacheProvider;
