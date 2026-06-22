const logger = require('../../config/logger');
const AppError = require('./AppError');
const env = require('../../config/env');

/**
 * ErrorHandler - Middleware central de tratamento de erros
 */
class ErrorHandler {
  /**
   * Converte erros desconhecidos ou de bibliotecas em AppError
   */
  static handleError(err) {
    let error = err;

    // Trata erros de validação do Zod
    if (err.name === 'ZodError') {
      const message = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      error = new AppError(`Erro de validação: ${message}`, 400);
    }

    // Trata erros específicos do PostgreSQL / Supabase
    if (err.code === '23505') { // Unique violation
      error = new AppError('Este registro já existe em nosso sistema.', 409);
    }

    if (err.code === '23503') { // Foreign key violation
      error = new AppError('Operação inválida: Registro pai não encontrado.', 400);
    }

    // Se não for uma instância de AppError, transforma em Internal Server Error
    if (!(error instanceof AppError)) {
      const statusCode = error.statusCode || 500;
      const message = error.message || 'Erro interno do servidor';
      error = new AppError(message, statusCode, false, err.stack);
    }

    return error;
  }

  /**
   * Middleware para Express (err, req, res, next)
   */
  static middleware(err, req, res, next) {
    let error = ErrorHandler.handleError(err);

    // Logging do erro
    if (error.isOperational) {
      logger.warn(`[Operational Error] ${req.method} ${req.url} - Status: ${error.statusCode} - Message: ${error.message}`);
    } else {
      logger.error(`[Critical Error] ${req.method} ${req.url}`, {
        status: error.statusCode,
        message: error.message,
        stack: error.stack,
      });
    }

    // Resposta para o cliente
    const response = {
      status: 'error',
      message: error.message,
      ...(env.NODE_ENV === 'development' && { stack: error.stack })
    };

    // Adiciona detalhes de validação se existirem (específico para ZodError mapeado)
    if (err.name === 'ZodError') {
      response.errors = err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }));
    }

    return res.status(error.statusCode).json(response);
  }

  /**
   * Captura erros em rotas assíncronas (Wrapper para evitar try/catch repetitivo)
   */
  static catchAsync(fn) {
    return (req, res, next) => {
      fn(req, res, next).catch(next);
    };
  }
}

module.exports = ErrorHandler;