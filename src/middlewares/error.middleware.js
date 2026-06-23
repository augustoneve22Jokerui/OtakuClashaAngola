const ErrorHandler = require('../core/errors/ErrorHandler');

/**
 * ==================================================
 * ERROR MIDDLEWARE GLOBAL (EXPRESS)
 * ==================================================
 * Última camada do pipeline de requisições.
 * Captura todos os erros da aplicação.
 */
const errorMiddleware = (err, req, res, next) => {
  try {
    // Validação defensiva
    if (
      ErrorHandler &&
      typeof ErrorHandler.middleware === 'function'
    ) {
      return ErrorHandler.middleware(err, req, res, next);
    }

    // FALLBACK caso ErrorHandler falhe
    const statusCode = err.statusCode || 500;

    return res.status(statusCode).json({
      status: 'error',
      message: err.message || 'Erro interno do servidor',
    });

  } catch (fatalError) {
    // Último nível de segurança (nunca deixa crashar)
    return res.status(500).json({
      status: 'error',
      message: 'Erro crítico no sistema de tratamento de erros',
    });
  }
};

module.exports = errorMiddleware;