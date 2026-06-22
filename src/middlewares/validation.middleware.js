const AppError = require('../core/errors/AppError');
const logger = require('../config/logger');

/**
 * validationMiddleware - Valida os dados da requisição contra um esquema Zod.
 * 
 * @param {Object} schemas - Objeto contendo esquemas para body, query ou params.
 * @param {import('zod').ZodSchema} [schemas.body] - Esquema para o corpo da requisição.
 * @param {import('zod').ZodSchema} [schemas.query] - Esquema para os parâmetros de busca.
 * @param {import('zod').ZodSchema} [schemas.params] - Esquema para os parâmetros de rota.
 */
const validationMiddleware = (schemas) => {
  return async (req, res, next) => {
    try {
      // Validar Body se houver esquema definido
      if (schemas.body) {
        const validatedBody = await schemas.body.parseAsync(req.body);
        req.body = validatedBody; // Substitui pelo dado sanitizado
      }

      // Validar Query se houver esquema definido
      if (schemas.query) {
        const validatedQuery = await schemas.query.parseAsync(req.query);
        req.query = validatedQuery;
      }

      // Validar Params se houver esquema definido
      if (schemas.params) {
        const validatedParams = await schemas.params.parseAsync(req.params);
        req.params = validatedParams;
      }

      return next();
    } catch (error) {
      if (error.name === 'ZodError') {
        // O ErrorHandler centralizado já sabe lidar com ZodError, 
        // apenas repassamos para manter a consistência.
        return next(error);
      }

      logger.error(`[ValidationMiddleware] Unexpected error: ${error.message}`);
      return next(AppError.internal('Erro interno durante a validação dos dados.'));
    }
  };
};

module.exports = validationMiddleware;