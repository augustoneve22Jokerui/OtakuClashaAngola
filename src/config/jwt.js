const env = require('./env');

/**
 * Configurações globais para JWT (JSON Web Token)
 * Define segredos, tempos de expiração e algoritmos para Access e Refresh Tokens.
 */
const jwtConfig = {
  access: {
    secret: env.JWT_ACCESS_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    algorithm: 'HS256',
  },
  refresh: {
    secret: env.JWT_REFRESH_SECRET,
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    algorithm: 'HS256',
  },
  // Configuração para integração com tokens nativos do Supabase Auth
  supabase: {
    jwksUrl: env.SUPABASE_JWKS_URL,
    issuer: `${env.SUPABASE_URL}/auth/v1`,
    audience: 'authenticated',
  },
  // Configurações de Cookie para Refresh Token (Segurança Extra)
  cookieOptions: {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'Strict',
    path: '/api/v1/auth/refresh',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 dias em milissegundos
  },
};

/**
 * Validação de integridade das chaves JWT
 */
if (jwtConfig.access.secret === jwtConfig.refresh.secret) {
  console.warn(
    '⚠️ WARNING: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are identical. ' +
    'For better security in production, use different secrets.'
  );
}

module.exports = jwtConfig;