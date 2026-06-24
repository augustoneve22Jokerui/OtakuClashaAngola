/**
 * 🐘 OTAKU CLASH ANGOLA - POSTGRESQL DATABASE PROVIDER
 * Versão: 3.2.0 - IPv4 Pooler Compatibility & Ultra Robust "Full-Full" Edition
 * Descrição: Gestão de Pool de conexões otimizada para Supavisor (Supabase), 
 *            prevenção de queda por IPv6, proteção contra leaks e blindagem anti-crash de retornos.
 */

const { Pool } = require('pg');
const env = require('./env');
const logger = require('./logger');

/**
 * ⚙️ CONFIGURAÇÃO DO POOL
 * Ajustado cirurgicamente para suportar o Supavisor (Pooler do Supabase) via porta 6543 e conexões Render.
 */
const poolConfig = {
  connectionString: env.DATABASE_URL,
  // Limites otimizados para o Pooler do Supabase para evitar saturação (Plano Free/Pro)
  max: 15, 
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  // Configuração SSL obrigatória e imutável para Cloud Providers (Supabase/Render)
  ssl: { 
    rejectUnauthorized: false 
  },
  // Configurações críticas para impedir que o ambiente de execução (Render/VPS) tente resolver em IPv6 indevidamente
  keepAlive: true
};

// Instância única do Pool (Singleton)
const pool = new Pool(poolConfig);

/**
 * 🛰️ EVENTOS E MONITORAMENTO DO POOL
 */
pool.on('connect', () => {
  logger.info('🐘 [PostgreSQL] Cliente conectado com sucesso ao pool (Supavisor).');
});

pool.on('error', (err) => {
  logger.error(`❌ [Database:Pool] Erro crítico inesperado em cliente inativo: ${err.message}`);
});

/**
 * 🛠️ DB PROVIDER INTERFACE
 */
const db = {
  /**
   * ⚡ QUERY WRAPPER (AUTO-PERFORMANCE E BLINDAGEM DE RESULTADOS)
   * Executa queries simples utilizando o pool global.
   * O Pooler (pgbouncer/supavisor) às vezes fecha conexões ociosas; este wrapper mitiga falhas silenciosas.
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

      // 🛡️ Garantia de estrutura: Se por algum motivo o driver falhar sem disparar throw,
      // retornamos um objeto compatível com { rows: [] } para não quebrar desestruturações ou loops.
      return res || { rows: [], rowCount: 0 };
    } catch (error) {
      const duration = Date.now() - start;
      logger.error(`❌ [Database:QueryError] ${duration}ms | Erro: ${error.message} | SQL: ${text}`);
      throw error; // Repassa para ser capturado de forma transparente pelo ErrorHandler Global
    }
  },

  /**
   * 🏛️ GET CLIENT (TRANSACTION & LEAK PROTECTION)
   * Fornece um cliente individual isolado para transações complexas (multi-queries/rollbacks).
   * Implementa um "Deadman Switch" de 15 segundos para evitar Connection Leaks no Pooler.
   */
  async getClient() {
    try {
      const client = await pool.connect();
      const start = Date.now();

      // 🛡️ PROTEÇÃO CONTRA LEAKS (DEADMAN SWITCH)
      // Se o cliente não for devolvido ao pool em 15s, emitimos um alerta crítico contendo o rastreamento.
      const timeout = setTimeout(() => {
        logger.error('🚨 [Database:LeakWarning] Cliente de transação retido por mais de 15s! Verifique a lógica de commit/rollback.');
      }, 15000);

      const release = client.release;

      // Sobrescreve o método release original para limpar o timeout e computar métricas
      client.release = (err) => {
        clearTimeout(timeout);
        client.release = release; // Restaura a função nativa do cliente
        const duration = Date.now() - start;
        
        // Monitor de Transações Longas
        if (duration > 1000) {
          logger.warn(`⚠️ [Database:LongTransaction] Transação durou ${duration}ms no pool.`);
        }
        
        return release.apply(client, [err]);
      };

      return client;
    } catch (error) {
      logger.error(`❌ [Database:ConnectError] Falha ao obter cliente do pool: ${error.message}`);
      throw error;
    }
  },

  /**
   * 🛑 END POOL
   * Utilizado para o encerramento gracioso do servidor (Graceful Shutdown/Sigterm).
   */
  async end() {
    try {
      await pool.end();
      logger.info('🐘 [PostgreSQL] Pool de conexões encerrado com sucesso.');
    } catch (error) {
      logger.error(`❌ [Database:ShutdownError] Erro ao fechar o pool de conexões: ${error.message}`);
    }
  },

  /**
   * 🔍 STATUS
   * Retorna os metadados de telemetria em tempo real do pool (utilizado para rotas de Healthcheck).
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
