const logger = require('./logger');

/**
 * ==================================================
 * NULL REDIS CLIENT (FALLBACK TOTAL)
 * ==================================================
 */
class NullRedisClient {
  constructor() {
    this.connected = false;
    this.status = 'offline';
    this.isOpen = false;
    this.isReady = false;
  }

  on() {}
  off() {}
  duplicate() {
    return new NullRedisClient();
  }

  async ping() {
    return 'PONG';
  }

  async get() {
    return null;
  }

  async set() {
    return 'OK';
  }

  async del() {
    return 1;
  }

  async exists() {
    return 0;
  }

  async expire() {
    return 1;
  }

  async incr() {
    return 1;
  }

  async publish() {
    return 0;
  }

  async subscribe() {
    return 0;
  }

  async quit() {
    return true;
  }

  async disconnect() {
    return true;
  }
}

/**
 * ==================================================
 * PROVIDER HÍBRIDO
 * ==================================================
 */
let provider;

try {
  let cacheProvider = null;

  try {
    cacheProvider = require('./cache');
  } catch (err) {
    logger.warn('[HybridRedis] cache module indisponível');
  }

  const client =
    cacheProvider?.client || new NullRedisClient();

  provider = {
    enabled: !!cacheProvider?.client,
    client,
  };

  logger.info(
    '[HybridRedis] Provider inicializado (modo híbrido seguro)'
  );

} catch (error) {

  logger.warn(
    `[HybridRedis] fallback TOTAL ativado: ${error.message}`
  );

  provider = {
    enabled: false,
    client: new NullRedisClient(),
  };
}

module.exports = provider;
