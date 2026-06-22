const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

/**
 * Cliente Supabase Público (Anon)
 * Utilizado para operações que seguem as regras de Row Level Security (RLS).
 */
const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
);

/**
 * Cliente Supabase Administrativo (Service Role)
 * Utilizado para operações que exigem bypass de RLS e gestão administrativa.
 * NUNCA exponha a Secret Key ao frontend.
 */
const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SECRET_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
);

/**
 * Exportação dos clientes para uso em Repositories e Services
 */
module.exports = {
  supabase,
  supabaseAdmin
};