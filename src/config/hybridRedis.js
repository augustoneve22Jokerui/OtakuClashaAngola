/**
 * ==========================================
 * Hybrid Redis Provider
 * Redis Opcional com Fallback Transparente
 * ==========================================
 */

const logger = require('./logger');

class NullRedisClient {
  constructor() {
    this.connected = false;
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

let provider;

try {
  const cacheProvider = require('./cache');

  provider = {
    enabled: true,
    client: cacheProvider.client
  };

  logger.info(
    '[HybridRedis] Redis Provider carregado com sucesso.'
  );

} catch (error) {

  logger.warn(
    `[HybridRedis] Redis indisponível. Executando em modo standalone. Motivo: ${error.message}`
  );

  provider = {
    enabled: false,
    client: new NullRedisClient()
  };
}

module.exports = provider;
