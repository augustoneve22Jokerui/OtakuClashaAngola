const { Pool } = require('pg');
const env = require('./env');
const logger = require('./logger'); // Nota: Será gerado em breve, mas o import é obrigatório

/**
 * Configuração do Pool de Conexões PostgreSQL
 * Otimizado para integração com Supabase e ambientes de produção
 */
const poolConfig = {
  connectionString: env.DATABASE_URL,
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  // Máximo de clientes no pool
  max: 20,
  // Tempo máximo que um cliente pode ficar ocioso antes de ser fechado
  idleTimeoutMillis: 30000,
  // Tempo máximo para tentar uma conexão antes de retornar erro
  connectionTimeoutMillis: 2000,
  // SSL é obrigatório para conexões seguras com Supabase/Cloud
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
};

const pool = new Pool(poolConfig);

/**
 * Listener de Erros do Pool
 * Essencial para evitar que erros de rede ou perda de conexão derrubem o processo Node.js
 */
pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle database client', err);
  // Log estruturado será implementado no config/logger
  if (logger && logger.error) {
    logger.error('Database Pool Error', { error: err.message, stack: err.stack });
  }
});

/**
 * Helper para execução de queries com log de performance opcional
 */
const db = {
  /**
   * Executa uma query SQL simples
   * @param {string} text - SQL Query
   * @param {Array} params - Parâmetros da query
   */
  async query(text, params) {
    const start = Date.now();
    try {
      const res = await pool.query(text, params);
      const duration = Date.now() - start;
      
      // Log de queries lentas em desenvolvimento
      if (env.NODE_ENV === 'development' && duration > 100) {
        console.warn(`🐢 Slow query: ${text} [${duration}ms]`);
      }
      
      return res;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Adquire um cliente do pool para transações manuais
   */
  async getClient() {
    const client = await pool.connect();
    const query = client.query;
    const release = client.release;

    // Monkey patch para rastrear o tempo de checkout do cliente
    const timeout = setTimeout(() => {
      console.error('⚠️ A client has been checked out for more than 5 seconds!');
      console.error('Potential memory leak or unreleased transaction.');
    }, 5000);

    client.release = (err) => {
      clearTimeout(timeout);
      client.query = query;
      client.release = release;
      return release.apply(client, [err]);
    };

    return client;
  },

  /**
   * Finaliza o pool (usado em scripts de migração ou encerramento do servidor)
   */
  async end() {
    return await pool.end();
  }
};

module.exports = db;