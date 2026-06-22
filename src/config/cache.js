const Redis = require('ioredis');
const env = require('./env');
const logger = require('./logger');

/**
 * ==================================================
 * MEMORY FALLBACK (quando Redis não existir)
 * ==================================================
 */
const memoryCache = new Map();

/**
 * ==================================================
 * CONFIGURAÇÃO REDIS SEGURA
 * ==================================================
 */
const redisConfig = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  db: env.REDIS_DB || 0,
  keyPrefix: 'otaku_clash:',

  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);

    if (times > 5) {
      logger.warn(
        `[Redis] Muitas tentativas (${times}). Mantendo fallback em memória.`
      );
      return null;
    }

    return delay;
  },

  maxRetriesPerRequest: 2,
};

/**
 * ==================================================
 * INICIALIZAÇÃO SEGURA DO REDIS
 * ==================================================
 */
let cache = null;
let redisAvailable = false;

try {
  cache = new Redis(redisConfig);

  cache.on('connect', () => {
    redisAvailable = true;
    logger.info('🚀 Redis conectado (modo híbrido ativo)');
  });

  cache.on('error', (err) => {
    redisAvailable = false;
    logger.warn(
      `❌ Redis indisponível (fallback memória ativo): ${err.message}`
    );
  });

  cache.on('reconnecting', () => {
    logger.warn('🔄 Redis reconectando...');
  });

} catch (error) {
  logger.warn(
    `[Redis] Falha total na inicialização. Usando memória: ${error.message}`
  );

  cache = null;
  redisAvailable = false;
}

/**
 * ==================================================
 * CACHE PROVIDER HÍBRIDO
 * ==================================================
 */
const cacheProvider = {
  client: cache,

  /**
   * SET
   */
  async set(key, value, ttlSeconds = 3600) {
    const data = JSON.stringify(value);

    if (redisAvailable && cache) {
      try {
        return await cache.set(key, data, 'EX', ttlSeconds);
      } catch (err) {
        logger.warn('[Cache] fallback set -> memory');
      }
    }

    // fallback memória
    memoryCache.set(key, {
      value: data,
      expire: Date.now() + ttlSeconds * 1000,
    });

    return true;
  },

  /**
   * GET
   */
  async get(key) {
    if (redisAvailable && cache) {
      try {
        const data = await cache.get(key);
        if (!data) return null;
        return JSON.parse(data);
      } catch (err) {
        logger.warn('[Cache] fallback get -> memory');
      }
    }

    // fallback memória
    const entry = memoryCache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expire) {
      memoryCache.delete(key);
      return null;
    }

    try {
      return JSON.parse(entry.value);
    } catch {
      return entry.value;
    }
  },

  /**
   * DELETE
   */
  async del(key) {
    if (redisAvailable && cache) {
      try {
        return await cache.del(key);
      } catch {
        logger.warn('[Cache] fallback del -> memory');
      }
    }

    return memoryCache.delete(key);
  },

  /**
   * DELETE BY PATTERN
   */
  async delByPattern(pattern) {
    const fullPattern = `otaku_clash:${pattern}`;

    if (redisAvailable && cache) {
      try {
        const keys = await cache.keys(fullPattern);

        if (keys.length > 0) {
          const rawKeys = keys.map(k =>
            k.replace('otaku_clash:', '')
          );

          return await cache.del(rawKeys);
        }
      } catch {
        logger.warn('[Cache] fallback pattern -> memory');
      }
    }

    // fallback memória
    for (const key of memoryCache.keys()) {
      if (key.includes(pattern.replace('*', ''))) {
        memoryCache.delete(key);
      }
    }

    return true;
  },

  /**
   * STATUS DO CACHE
   */
  isRedisAvailable() {
    return redisAvailable;
  }
};

module.exports = cacheProvider;
