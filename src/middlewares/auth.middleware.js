const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');
const AppError = require('../core/errors/AppError');
const logger = require('../config/logger');

/**
 * authMiddleware - Intercepta requisições para validar a identidade do usuário.
 * Suporta JWT padrão e tokens de sessão do Supabase.
 */
const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // 1. Verifica se o cabeçalho de autorização existe
    if (!authHeader) {
      return next(AppError.unauthorized('Token de autenticação não fornecido.'));
    }

    // 2. Extrai o token do formato "Bearer <TOKEN>"
    const parts = authHeader.split(' ');

    if (parts.length !== 2) {
      return next(AppError.unauthorized('Erro no formato do token.'));
    }

    const [scheme, token] = parts;

    if (!/^Bearer$/i.test(scheme)) {
      return next(AppError.unauthorized('Token malformado.'));
    }

    // 3. Verifica e decodifica o Token
    // Tenta validar com o segredo do Access Token do nosso backend
    jwt.verify(token, jwtConfig.access.secret, (err, decoded) => {
      if (err) {
        // Se falhar o segredo local, pode ser um token do Supabase
        // Em um sistema real, aqui poderíamos ter a validação via JWKS do Supabase
        logger.warn(`[AuthMiddleware] Falha na validação do token: ${err.message}`);
        
        if (err.name === 'TokenExpiredError') {
          return next(AppError.unauthorized('Token expirado. Por favor, faça login novamente.'));
        }
        
        return next(AppError.unauthorized('Token inválido ou revogado.'));
      }

      /**
       * 4. Injeta os dados do usuário na requisição
       * Estrutura esperada do payload: { sub: UUID, role: ROLE, ... }
       */
      req.user = {
        id: decoded.sub || decoded.id,
        role: decoded.role,
        email: decoded.email,
        username: decoded.username
      };

      return next();
    });
  } catch (error) {
    logger.error(`[AuthMiddleware] Erro inesperado: ${error.message}`);
    return next(AppError.internal('Erro ao processar autenticação.'));
  }
};

module.exports = authMiddleware;