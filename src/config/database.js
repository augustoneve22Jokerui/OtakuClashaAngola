const { Pool } = require('pg');
const env = require('./env');
const logger = require('./logger');

/**
 * ==================================================
 * ESTADO GLOBAL DO DB
 * ==================================================
 */
let pool = null;
let dbAvailable = false;

/**
 * ==================================================
 * CONFIGURAÇÃO SEGURA
 * ==================================================
 */
const poolConfig = {
  connectionString: env.DATABASE_URL,

  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,

  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,

  ssl:
    env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
};

/**
 * ==================================================
 * INICIALIZAÇÃO HÍBRIDA (SAFE BOOT)
 * ==================================================
 */
function initDatabase() {
  try {
    if (!env.DATABASE_URL && !env.DB_HOST) {
      logger.warn(
        '[DB] Nenhuma configuração encontrada. Rodando em modo OFFLINE.'
      );
      dbAvailable = false;
      return;
    }

    pool = new Pool(poolConfig);

    pool.on('connect', () => {
      dbAvailable = true;
      logger.info('🚀 PostgreSQL conectado (modo híbrido ativo)');
    });

    pool.on('error', (err) => {
      dbAvailable = false;

      logger.warn(
        `❌ DB indisponível (fallback ativo): ${err.message}`
      );
    });

    pool.on('remove', () => {
      logger.warn('[DB] Cliente removido do pool');
    });

  } catch (error) {
    dbAvailable = false;
    pool = null;

    logger.warn(
      `[DB] Falha total na inicialização. Modo offline ativo: ${error.message}`
    );
  }
}

/**
 * Inicializa imediatamente ao importar
 */
initDatabase();

/**
 * ==================================================
 * DB PROVIDER HÍBRIDO
 * ==================================================
 */
const db = {
  /**
   * STATUS DO DB
   */
  isAvailable() {
    return dbAvailable && pool;
  },

  /**
   * QUERY SEGURA
   */
  async query(text, params = []) {
    if (!this.isAvailable()) {
      logger.warn('[DB] Query ignorada (modo offline)');
      return null;
    }

    const start = Date.now();

    try {
      const res = await pool.query(text, params);

      const duration = Date.now() - start;

      if (env.NODE_ENV === 'development' && duration > 100) {
        logger.warn(`🐢 Slow query: ${duration}ms -> ${text}`);
      }

      return res;
    } catch (error) {
      logger.error('[DB] Query falhou:', error.message);
      return null;
    }
  },

  /**
   * CLIENTE PARA TRANSAÇÕES
   */
  async getClient() {
    if (!this.isAvailable()) {
      throw new Error('[DB] Cliente indisponível (offline mode)');
    }

    const client = await pool.connect();

    const originalRelease = client.release;

    const timeout = setTimeout(() => {
      logger.warn(
        '⚠️ Cliente DB preso > 5s (possível leak de transação)'
      );
    }, 5000);

    client.release = (err) => {
      clearTimeout(timeout);
      client.release = originalRelease;
      return originalRelease.apply(client, [err]);
    };

    return client;
  },

  /**
   * FINALIZAÇÃO SEGURA
   */
  async end() {
    if (!pool) return;

    try {
      await pool.end();
      dbAvailable = false;
      logger.info('[DB] Pool encerrado com sucesso');
    } catch (error) {
      logger.warn('[DB] Erro ao encerrar pool:', error.message);
    }
  }
};

module.exports = db;