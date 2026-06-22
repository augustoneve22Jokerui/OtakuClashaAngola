const Redis = require('ioredis');
const env = require('./env');
const logger = require('./logger');

/**
 * ==================================================
 * MEMORY CACHE (FALLBACK)
 * ==================================================
 */
const memoryCache = new Map();

/**
 * ==================================================
 * ESTADO GLOBAL
 * ==================================================
 */
let redis = null;
let redisReady = false;

/**
 * ==================================================
 * VERIFICA SE REDIS DEVE SER USADO
 * ==================================================
 */
const shouldUseRedis =
  env.REDIS_ENABLED === 'true' &&
  env.REDIS_HOST &&
  env.REDIS_HOST !== '127.0.0.1' &&
  env.REDIS_HOST !== 'localhost';

/**
 * ==================================================
 * INIT REDIS (SAFE - NUNCA CRASHA)
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

      // 🔥 IMPORTANTE: impede crash do bootstrap
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,

      // 🔥 elimina retry infinito
      retryStrategy() {
        return null;
      },
    });

    redis.on('connect', () => {
      redisReady = true;
      logger.info('🚀 Redis conectado (modo híbrido ativo)');
    });

    redis.on('error', (err) => {
      redisReady = false;
      logger.warn(`[Redis] fallback memory ativo: ${err.message}`);
    });

    redis.on('end', () => {
      redisReady = false;
      logger.warn('[Redis] conexão encerrada (memory fallback)');
    });

  } catch (err) {
    logger.warn(`[Redis] desativado automaticamente: ${err.message}`);
    redis = null;
  }
} else {
  logger.warn('[Redis] MEMORY MODE ativado (seguro)');
}

/**
 * ==================================================
 * CACHE PROVIDER HÍBRIDO
 * ==================================================
 */
const cacheProvider = {
  client: redis,

  /**
   * STATUS
   */
  isRedis() {
    return redis && redisReady;
  },

  /**
   * SET
   */
  async set(key, value, ttl = 3600) {
    const data = JSON.stringify(value);

    if (this.isRedis()) {
      try {
        return await redis.set(key, data, 'EX', ttl);
      } catch (err) {
        logger.warn('[Cache] Redis set falhou, fallback memory');
      }
    }

    memoryCache.set(key, {
      value: data,
      expire: Date.now() + ttl * 1000,
    });

    return true;
  },

  /**
   * GET
   */
  async get(key) {
    if (this.isRedis()) {
      try {
        const data = await redis.get(key);
        if (data) return JSON.parse(data);
      } catch (err) {
        logger.warn('[Cache] Redis get falhou, fallback memory');
      }
    }

    const mem = memoryCache.get(key);

    if (!mem) return null;

    if (Date.now() > mem.expire) {
      memoryCache.delete(key);
      return null;
    }

    try {
      return JSON.parse(mem.value);
    } catch {
      return mem.value;
    }
  },

  /**
   * DELETE
   */
  async del(key) {
    if (this.isRedis()) {
      try {
        return await redis.del(key);
      } catch (err) {
        logger.warn('[Cache] Redis del falhou');
      }
    }

    return memoryCache.delete(key);
  },

  /**
   * PING (SAFE - NUNCA CRASHA)
   */
  async ping() {
    if (this.isRedis()) {
      try {
        return await redis.ping();
      } catch {
        return null;
      }
    }

    return 'memory-mode';
  },

  /**
   * CLEANUP MEMORY CACHE
   */
  cleanup() {
    const now = Date.now();

    for (const [key, value] of memoryCache.entries()) {
      if (value.expire && value.expire < now) {
        memoryCache.delete(key);
      }
    }
  }
};

module.exports = cacheProvider;
