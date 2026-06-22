const Redis = require('ioredis');
const env = require('./env');
const logger = require('./logger');

/**
 * Configuração da instância Redis para Cache e Estado da Aplicação.
 * Utiliza ioredis para suporte a clusters, sentinelas e pipelines de alta performance.
 */
const redisConfig = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  db: env.REDIS_DB || 0,
  keyPrefix: 'otaku_clash:', // Namespace para evitar colisões em instâncias compartilhadas
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    if (times > 10) {
      logger.error(`[Redis] Max retry attempts reached (${times}). Connection failed.`);
      return null; // Interrompe as tentativas após 10 erros consecutivos
    }
    return delay;
  },
  maxRetriesPerRequest: 3,
};

// Inicialização da instância do Redis
const cache = new Redis(redisConfig);

/**
 * Listeners de Monitoramento do Redis
 */
cache.on('connect', () => {
  logger.info('🚀 Redis client connected successfully');
});

cache.on('error', (err) => {
  logger.error('❌ Redis Client Error', {
    message: err.message,
    stack: err.stack
  });
});

cache.on('reconnecting', () => {
  logger.warn('🔄 Redis client is attempting to reconnect...');
});

/**
 * Wrapper de utilitários para facilitar o uso do cache em Repositories/Services
 */
const cacheProvider = {
  client: cache,

  /**
   * Define um valor no cache com tempo de expiração
   * @param {string} key 
   * @param {any} value 
   * @param {number} ttlSeconds - Tempo de vida em segundos (padrão 1 hora)
   */
  async set(key, value, ttlSeconds = 3600) {
    const data = JSON.stringify(value);
    return await cache.set(key, data, 'EX', ttlSeconds);
  },

  /**
   * Obtém um valor do cache e faz o parse automático do JSON
   * @param {string} key 
   */
  async get(key) {
    const data = await cache.get(key);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch (err) {
      return data;
    }
  },

  /**
   * Remove uma chave específica
   */
  async del(key) {
    return await cache.del(key);
  },

  /**
   * Limpa chaves baseadas em um padrão (Pattern)
   */
  async delByPattern(pattern) {
    const keys = await cache.keys(`otaku_clash:${pattern}`);
    if (keys.length > 0) {
      // Remove o prefixo interno do ioredis para evitar duplicação no comando del
      const rawKeys = keys.map(key => key.replace('otaku_clash:', ''));
      return await cache.del(rawKeys);
    }
    return 0;
  }
};

module.exports = cacheProvider;