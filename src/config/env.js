/**
 * 🚀 OTAKU CLASH ANGOLA - ENVIRONMENT CONFIGURATOR
 * Versão: 3.1.0 - Zod Schema Validation & TMDB Integration Edition
 * Descrição: Centralizador e validador estrito de variáveis de ambiente do ecossistema.
 *            Garante falha em tempo de inicialização (Fail-Fast) caso falte alguma chave.
 */

const dotenv = require('dotenv');
const { z } = require('zod');

// Carrega o arquivo .env para o process.env
dotenv.config();

/**
 * Schema de validação declarativo e estrito do Zod
 */
const envSchema = z.object({
  // ============================================================
  // SERVER CONFIGURATION
  // ============================================================
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().transform(Number).default('5000'),
  API_URL: z.string().url(),

  // ============================================================
  // DATABASE - POSTGRESQL (FRANKFURT POOLER)
  // ============================================================
  DATABASE_URL: z.string().min(1),
  DB_HOST: z.string().min(1),
  DB_PORT: z.string().transform(Number).default('5432'),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),

  // ============================================================
  // SUPABASE INFRASTRUCTURE
  // ============================================================
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  SUPABASE_JWKS_URL: z.string().url(),

  // ============================================================
  // SECURITY - JWT ECOSYSTEM
  // ============================================================
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('1d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // ============================================================
  // REDIS CACHE ENGINE
  // ============================================================
  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.string().transform(Number).default('6379'),
  REDIS_PASSWORD: z.string().optional().nullable(),

  // ============================================================
  // STORAGE BUCKETS (OBJECT STORAGE)
  // ============================================================
  STORAGE_BUCKET_AVATARS: z.string().default('avatars'),
  STORAGE_BUCKET_ANIMES: z.string().default('anime-images'),
  STORAGE_BUCKET_CHARACTERS: z.string().default('character-images'),
  STORAGE_BUCKET_QUIZ: z.string().default('quiz-images'),
  STORAGE_BUCKET_TOURNAMENTS: z.string().default('tournament-banners'),

  // ============================================================
  // EXTERNAL APIS & INTEGRATIONS
  // ============================================================
  JIKAN_API_URL: z.string().url().default('https://api.jikan.moe/v4'),
  
  // TMDB INTEGRATION (⚡ Sincronizado para metadados de mídia complementares)
  TMDB_API_KEY: z.string().default('ebc6c62b1d31f28ab2d155ad4c921657'),
  TMDB_API_URL: z.string().url().default('https://api.themoviedb.org/3'),

  // ============================================================
  // LOGGING AUDIT ENGINE
  // ============================================================
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('info'),
});

// Executa o parse seguro do ambiente
const _env = envSchema.safeParse(process.env);

/**
 * 🔒 FAIL-FAST GUARD
 * Em ambiente enterprise, não permitimos que a aplicação inicie de forma degradada ou cega.
 */
if (_env.success === false) {
  console.error('❌ Invalid environment variables configuration:', JSON.stringify(_env.error.format(), null, 2));
  process.exit(1);
}

module.exports = _env.data;
