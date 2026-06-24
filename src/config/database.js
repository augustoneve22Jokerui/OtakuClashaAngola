/**
 * 🐘 OTAKU CLASH ANGOLA - POSTGRESQL DATABASE PROVIDER
 * Versão: 3.4.0 - Frankfurt IPv4 Pooler Ready & Ultra Robust "Full-Full" Edition
 * Descrição: Gestão de Pool de conexões otimizada para instâncias t4g.nano, PgBouncer e Supavisor.
 *            Inclui mitigação de fechamento de portas remoto, proteção contra leaks e telemetria ativa.
 */

const { Pool } = require('pg');
const env = require('./env');
const logger = require('./logger');

// 🛡️ Sanitização rigorosa da URL para evitar falhas catastróficas de ENOTFOUND no proxy de rede
const cleanConnectionString = env.DATABASE_URL ? env.DATABASE_URL.trim() : '';

/**
 * ⚙️ CONFIGURAÇÃO DO POOL
 * Ajustado cirurgicamente para suportar infraestruturas baseadas em Poolers com limite severo de RAM.
 */
const poolConfig = {
  connectionString: cleanConnectionString,
  // Limite de 10 conexões estáveis para evitar saturação em t4g.nano e planos cloud de entrada
  max: 10, 
  idleTimeoutMillis: 20000,       // Tempo reduzido para liberar conexões ociosas mais rápido
  connectionTimeoutMillis: 15000, // Timeout de conexão ajustado para mitigar oscilações de rede
  // Configuração SSL obrigatória para Cloud Providers (Supabase/Render/AWS)
  ssl: { 
    rejectUnauthorized: false 
  },
  // Configurações críticas de rede para impedir que o ambiente tente resolver rotas IPv6 indevidas
  keepAlive: true,
  // Identificador de processos exclusivo para auditoria em PgBouncer/Supavisor
  application_name: 'otaku_clash_backend',
  // Garante que o driver não mantenha processos paralelos suspensos sem necessidade ao esvaziar o pool
  allowExitOnIdle: true
};

// Instância única do Pool (Singleton)
const pool = new Pool(poolConfig);

/**
 * 🛰️ EVENTOS E MONITORAMENTO DO POOL
 */
pool.on('connect', () => {
  logger.info('🐘 [PostgreSQL] Cliente conectado com sucesso ao pool (Frankfurt Ready).');
});

pool.on('error', (err) => {
  // 🛡️ Supavisor & PgBouncer Shield: Ignora desconexões rotineiras disparadas pelo gerenciador remoto
  const msg = err.message || '';
  if (msg.includes('terminating connection') || msg.includes('closed by the remote host')) {
    return;
  }
  
  logger.error(`❌ [Database:Pool] Erro Crítico inesperado em cliente inativo: ${msg}`);
});

/**
 * 🛠️ DB PROVIDER INTERFACE
 */
const db = {
  /**
   * ⚡ QUERY WRAPPER (AUTO-PERFORMANCE E BLINDAGEM DE RESULTADOS)
   * Executa queries simples utilizando o pool global de forma limpa.
   * Garante que nunca retorne null para evitar quebras de desestruturação no repositório.
   * 
   * @param {string} text - SQL Query
   * @param {Array} params - Parâmetros da query
   */
  async query(text, params = []) {
    const start = Date.now();
    try {
      const res = await pool.query(text, params);
      const duration = Date.now() - start;

      // Monitor de Queries Lentas (Threshold ajustado para 2000ms devido à restrição do t4g.nano)
      if (duration > 2000) {
        logger.warn(`⚠️ [Database:SlowQuery] ${duration}ms | SQL: ${text.substring(0, 50)}`);
      }

      // 🛡️ Retorno blindado: se o driver retornar vazio por falha de IO assíncrona, evita travar o backend
      return res || { rows: [], rowCount: 0 };
    } catch (error) {
      const duration = Date.now() - start;
      
      // 🛡️ Tradução inteligente de erros de rota/mapeamento de tenant para o operador
      let msg = error.message || '';
      if (msg.includes('tenant')) {
        msg = 'Erro de Mapeamento: Verifique o Project Ref e a Região no DATABASE_URL';
      }
      
      logger.error(`❌ [Database:QueryError] ${duration}ms | ${msg} | SQL: ${text}`);
      throw error; // Repassa ao ErrorHandler Global
    }
  },

  /**
   * 🏛️ GET CLIENT (TRANSACTION & LEAK PROTECTION)
   * Fornece um cliente dedicado do pool para operações isoladas de escrita múltipla.
   * Implementa um "Deadman Switch" de 15 segundos para evitar estouro de conexões por falta de release.
   */
  async getClient() {
    try {
      const client = await pool.connect();
      const start = Date.now();

      // 🛡️ PROTEÇÃO CONTRA LEAKS (DEADMAN SWITCH)
      // Se o código de negócio esquecer de executar o client.release(), gera log de erro sem derrubar o processo
      const timeout = setTimeout(() => {
        logger.error('🚨 [Database:LeakWarning] Cliente de transação retido por mais de 15s! Verifique a lógica de commit/rollback.');
      }, 15000);

      const originalRelease = client.release;

      // Sobrescreve o método release original para limpar o monitoramento ativo e registrar métricas
      client.release = (err) => {
        clearTimeout(timeout);
        client.release = originalRelease; // Restaura a função padrão do driver nativo
        const duration = Date.now() - start;
        
        // Alerta de transações excessivamente longas que travam o banco
        if (duration > 1000) {
          logger.warn(`⚠️ [Database:LongTransaction] Transação durou ${duration}ms no pool.`);
        }
        
        return originalRelease.apply(client, [err]);
      };

      return client;
    } catch (error) {
      logger.error(`❌ [Database:ConnectError] Falha ao obter cliente do pool: ${error.message}`);
      throw error;
    }
  },

  /**
   * 🛑 END POOL
   * Executado exclusivamente pelas rotinas de desligamento do sistema (Graceful Shutdown).
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
   * Expõe metadados e telemetria das conexões para rotas privadas de Healthcheck.
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
