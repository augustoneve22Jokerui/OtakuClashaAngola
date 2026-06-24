/**
 * 🐘 OTAKU CLASH ANGOLA - POSTGRESQL DATABASE PROVIDER
 * Versão: 3.1.0 - Null-Return Protection & Ultra Robust "Full-Full" Edition
 * Descrição: Gestão de Pool de conexões, monitoramento de performance, proteção contra leaks e blindagem de retornos nulos.
 */

const { Pool } = require('pg');
const env = require('./env');
const logger = require('./logger');

/**
 * ⚙️ CONFIGURAÇÃO DO POOL
 */
const poolConfig = {
  connectionString: env.DATABASE_URL,
  // Limites de conexões para evitar saturação no Supabase (Plano Free/Pro)
  max: 20, 
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  // Configuração SSL obrigatória para Cloud Providers (Supabase/Render)
  // Fixado incondicionalmente na v3.1.0 para evitar falhas de handshake no proxy
  ssl: { rejectUnauthorized: false }
};

// Instância única do Pool (Singleton)
const pool = new Pool(poolConfig);

/**
 * 🛰️ EVENTOS DO POOL
 */
pool.on('connect', () => {
  logger.debug('[Database] Nova conexão estabelecida com o cluster.');
});

pool.on('error', (err) => {
  logger.error('❌ [Database:Pool] Erro inesperado em cliente inactivo:', err);
});

/**
 * 🛠️ DB PROVIDER INTERFACE
 */
const db = {
  /**
   * ⚡ QUERY WRAPPER (AUTO-PERFORMANCE E BLINDAGEM DE RESULTADOS)
   * Executa queries simples utilizando o pool global.
   * Garante que nunca retorne null para evitar crash de desestruturação no repositório.
   * 
   * @param {string} text - SQL Query
   * @param {Array} params - Parâmetros da query
   */
  async query(text, params = []) {
    const start = Date.now();
    try {
      const res = await pool.query(text, params);
      const duration = Date.now() - start;

      // Monitor de Queries Lentas (Performance Optimization - Threshold: 1000ms)
      if (duration > 1000) {
        logger.warn(`⚠️ [Database:SlowQuery] ${duration}ms | SQL: ${text.substring(0, 100)}...`);
      }

      // 🛡️ Garantia de estrutura: Se por algum motivo o driver falhar sem throw,
      // retornamos um objeto compatível com { rows: [] } para não quebrar maps/filters
      return res || { rows: [], rowCount: 0 };
    } catch (error) {
      const duration = Date.now() - start;
      logger.error(`❌ [Database:QueryError] ${duration}ms | Erro: ${error.message} | SQL: ${text}`);
      throw error; // Repassa para ser capturado pelo ErrorHandler Global
    }
  },

  /**
   * 🏛️ GET CLIENT (TRANSACTION & LEAK PROTECTION)
   * Fornece um cliente individual para transações complexas.
   * Implementa um "Deadman Switch" para evitar Connection Leaks.
   */
  async getClient() {
    const client = await pool.connect();
    const start = Date.now();

    // 🛡️ PROTEÇÃO CONTRA LEAKS
    // Se o cliente não for devolvido ao pool em 10s, emitimos um alerta crítico.
    const timeout = setTimeout(() => {
      logger.error(`🚨 [Database:LeakWarning] Cliente de transação retido por mais de 10s! Verifique a lógica de commit/rollback.`);
    }, 10000);

    const release = client.release;

    // Sobrescreve o método release original para limpar o timeout
    client.release = (err) => {
      clearTimeout(timeout);
      client.release = release; // Restaura a função original
      const duration = Date.now() - start;
      
      // Monitor de Transações Lentas
      if (duration > 1000) {
        logger.warn(`⚠️ [Database:LongTransaction] Transação durou ${duration}ms.`);
      }
      
      return release.apply(client, [err]);
    };

    return client;
  },

  /**
   * 🛑 END POOL
   * Utilizado para encerramento gracioso do servidor (Graceful Shutdown).
   */
  async end() {
    try {
      await pool.end();
      logger.info('[Database] Pool de conexões encerrado com sucesso.');
    } catch (error) {
      logger.error('❌ [Database:Shutdown] Erro ao fechar o pool:', error);
    }
  },

  /**
   * 🔍 STATUS
   * Retorna os metadados e saúde atual do pool (útil para rotas de Healthcheck).
   */
  get stats() {
    return {
      totalConnections: pool.totalCount,
      idleConnections: pool.idleCount,
      waitingRequests: pool.waitingCount
    };
  }
};

module.exports = db;
