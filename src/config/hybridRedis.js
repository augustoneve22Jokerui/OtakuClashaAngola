/**
 * ⚡ OTAKU CLASH ANGOLA - HYBRID REDIS PROVIDER
 * Versão: 2.0.0 - Enterprise Resilient
 * Descrição: Define o cliente de fallback (NullRedisClient) com interface completa
 * para garantir que o sistema não crashe sem uma instância real do Redis.
 */

const logger = require('./logger');

/**
 * ==================================================
 * NULL REDIS CLIENT (FULL MEMORY FALLBACK)
 * ==================================================
 * Mimica a interface do ioredis usando armazenamento 
 * volátil em memória JS para evitar erros de "is not a function".
 */
class NullRedisClient {
  constructor() {
    this.connected = false;
    this.status = 'offline';
    this.isOpen = false;
    this.isReady = false;
    this.isFallback = true;
    
    // Armazenamento interno para simular Sets e Lists do Redis
    this._storage = new Map();
    
    logger.warn('[Redis:Fallback] NullRedisClient instanciado. Operando em modo de memória local.');
  }

  // Métodos de utilidade do ioredis
  on() { return this; }
  off() { return this; }
  once() { return this; }
  removeListener() { return this; }
  duplicate() {
    return new NullRedisClient();
  }

  /**
   * MOCK: PING
   */
  async ping() {
    return 'PONG';
  }

  /**
   * MOCK: GET
   */
  async get(key) {
    return this._storage.get(key) || null;
  }

  /**
   * MOCK: SET / SETEX
   */
  async set(key, value) {
    this._storage.set(key, value);
    return 'OK';
  }

  async setex(key, seconds, value) {
    this._storage.set(key, value);
    return 'OK';
  }

  /**
   * MOCK: DEL / EXISTS
   */
  async del(key) {
    const exists = this._storage.has(key);
    this._storage.delete(key);
    return exists ? 1 : 0;
  }

  async exists(key) {
    return this._storage.has(key) ? 1 : 0;
  }

  /**
   * MOCK: SETS (Utilizado pelo PresenceController)
   */
  async sadd(key, member) {
    if (!this._storage.has(key)) {
      this._storage.set(key, new Set());
    }
    const set = this._storage.get(key);
    const beforeSize = set.size;
    set.add(member);
    return set.size > beforeSize ? 1 : 0;
  }

  async srem(key, member) {
    if (!this._storage.has(key)) return 0;
    const set = this._storage.get(key);
    return set.delete(member) ? 1 : 0;
  }

  async smembers(key) {
    if (!this._storage.has(key)) return [];
    const set = this._storage.get(key);
    return Array.from(set);
  }

  async sismember(key, member) {
    if (!this._storage.has(key)) return 0;
    const set = this._storage.get(key);
    return set.has(member) ? 1 : 0;
  }

  /**
   * MOCK: LISTS (Utilizado pelo MatchmakingController)
   */
  async rpush(key, value) {
    if (!this._storage.has(key)) {
      this._storage.set(key, []);
    }
    const list = this._storage.get(key);
    list.push(value);
    return list.length;
  }

  async lpop(key) {
    if (!this._storage.has(key)) return null;
    const list = this._storage.get(key);
    return list.shift() || null;
  }

  async lrange(key, start, stop) {
    if (!this._storage.has(key)) return [];
    const list = this._storage.get(key);
    // Redis lrange é inclusivo no stop
    const actualStop = stop === -1 ? list.length : stop + 1;
    return list.slice(start, actualStop);
  }

  async lrem(key, count, value) {
    if (!this._storage.has(key)) return 0;
    let list = this._storage.get(key);
    const initialLength = list.length;
    this._storage.set(key, list.filter(item => item !== value));
    return initialLength - this._storage.get(key).length;
  }

  /**
   * MOCK: COUNTERS
   */
  async incr(key) {
    let val = parseInt(this._storage.get(key)) || 0;
    val++;
    this._storage.set(key, val.toString());
    return val;
  }

  async expire() { return 1; }
  async publish() { return 0; }
  async subscribe() { return 0; }

  async quit() {
    this._storage.clear();
    return 'OK';
  }

  async disconnect() {
    return true;
  }
}

/**
 * ==================================================
 * PROVIDER HÍBRIDO EXPORTADO
 * ==================================================
 */
let provider;

try {
  let cacheModule = null;
  try {
    // Tenta carregar o cache real
    cacheModule = require('./cache');
  } catch (err) {
    logger.warn('[HybridRedis] Módulo de cache real não pôde ser carregado.');
  }

  const client = cacheModule?.client || new NullRedisClient();

  provider = {
    enabled: !!(cacheModule?.client && !cacheModule.client.isFallback),
    client: client,
  };

  if (provider.enabled) {
    logger.info('[HybridRedis] Sistema utilizando Redis Engine externo.');
  } else {
    logger.warn('[HybridRedis] Sistema utilizando Fallback Engine interno.');
  }

} catch (error) {
  logger.error(`[HybridRedis] Falha catastrófica no bootstrap: ${error.message}`);
  
  provider = {
    enabled: false,
    client: new NullRedisClient(),
  };
}

module.exports = provider;