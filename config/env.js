const dotenv = require('dotenv');
const { z } = require('zod');

// Carrega o arquivo .env
dotenv.config();

const envSchema = z.object({
  // SERVER
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().transform(Number).default('5000'),
  API_URL: z.string().url(),

  // DATABASE - POSTGRESQL
  DATABASE_URL: z.string().min(1),
  DB_HOST: z.string().min(1),
  DB_PORT: z.string().transform(Number).default('5432'),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),

  // SUPABASE
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  SUPABASE_JWKS_URL: z.string().url(),

  // SECURITY - JWT
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('1d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // REDIS
  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.string().transform(Number).default('6379'),
  REDIS_PASSWORD: z.string().optional().nullable(),

  // STORAGE BUCKETS
  STORAGE_BUCKET_AVATARS: z.string().default('avatars'),
  STORAGE_BUCKET_ANIMES: z.string().default('anime-images'),
  STORAGE_BUCKET_CHARACTERS: z.string().default('character-images'),
  STORAGE_BUCKET_QUIZ: z.string().default('quiz-images'),
  STORAGE_BUCKET_TOURNAMENTS: z.string().default('tournament-banners'),

  // EXTERNAL APIS
  JIKAN_API_URL: z.string().url().default('https://api.jikan.moe/v4'),

  // LOGGING
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('info'),
});

const _env = envSchema.safeParse(process.env);

if (_env.success === false) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  
  // Em ambiente enterprise, não permitimos que o app rode com config errada
  process.exit(1);
}

module.exports = _env.data;