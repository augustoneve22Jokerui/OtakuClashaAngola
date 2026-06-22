const AppError = require('../core/errors/AppError');
const logger = require('../config/logger');

/**
 * roleMiddleware - Controla o acesso às rotas baseado no papel (role) do usuário.
 * Deve ser utilizado sempre APÓS o authMiddleware.
 * 
 * @param {...string} allowedRoles - Lista de papéis permitidos para a rota.
 */
const roleMiddleware = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      // 1. Verifica se o usuário foi autenticado previamente
      if (!req.user) {
        return next(AppError.unauthorized('Usuário não identificado para verificação de permissão.'));
      }

      // 2. Verifica se a role do usuário está na lista de permissões
      const hasPermission = allowedRoles.includes(req.user.role);

      if (!hasPermission) {
        logger.warn(`[RoleMiddleware] Acesso negado: Usuário ${req.user.id} com role ${req.user.role} tentou acessar rota restrita a [${allowedRoles.join(', ')}]`);
        
        return next(AppError.forbidden('Você não tem permissão suficiente para realizar esta ação.'));
      }

      // 3. Permissão concedida
      return next();
    } catch (error) {
      logger.error(`[RoleMiddleware] Erro na validação de permissões: ${error.message}`);
      return next(AppError.internal('Erro ao validar permissões de acesso.'));
    }
  };
};

module.exports = roleMiddleware;