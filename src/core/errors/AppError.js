class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true, stack = '') {
    super(message);

    this.statusCode = statusCode;
    this.isOperational = isOperational;

    this.name = this.constructor.name;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * 400 - Bad Request
   */
  static badRequest(message = 'Requisição inválida.') {
    return new AppError(message, 400);
  }

  /**
   * 401 - Unauthorized
   */
  static unauthorized(message = 'Não autorizado. Faça login novamente.') {
    return new AppError(message, 401);
  }

  /**
   * 403 - Forbidden
   */
  static forbidden(message = 'Você não tem permissão para acessar este recurso.') {
    return new AppError(message, 403);
  }

  /**
   * 404 - Not Found
   */
  static notFound(message = 'O recurso solicitado não foi encontrado.') {
    return new AppError(message, 404);
  }

  /**
   * 409 - Conflict
   */
  static conflict(message = 'Houve um conflito ao processar a requisição.') {
    return new AppError(message, 409);
  }

  /**
   * 422 - Unprocessable Entity
   */
  static unprocessable(message = 'Dados de entrada inválidos.') {
    return new AppError(message, 422);
  }

  /**
   * 500 - Internal Server Error
   */
  static internal(message = 'Erro interno do servidor.') {
    return new AppError(message, 500, false);
  }
}

module.exports = AppError;
