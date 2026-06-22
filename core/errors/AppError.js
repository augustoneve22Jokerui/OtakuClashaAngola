/**
 * AppError - Classe customizada para erros operacionais da aplicação.
 * Utilizada para padronizar as respostas de erro e facilitar o tratamento global.
 */
class AppError extends Error {
  /**
   * @param {string} message - Mensagem descritiva do erro.
   * @param {number} statusCode - Código de status HTTP (ex: 400, 404, 500).
   * @param {boolean} isOperational - Define se o erro é uma falha prevista de negócio.
   * @param {string} stack - Stack trace opcional.
   */
  constructor(message, statusCode = 500, isOperational = true, stack = '') {
    super(message);

    this.statusCode = statusCode;
    this.isOperational = isOperational;
    
    // Define o nome da classe no objeto de erro
    this.name = this.constructor.name;

    if (stack) {
      this.stack = stack;
    } else {
      // Captura o stack trace e o associa ao objeto, excluindo o construtor da pilha
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Factory Method para erros de Bad Request (400)
   */
  static badRequest(message = 'Requisição inválida.') {
    return new AppError(message, 400);
  }

  /**
   * Factory Method para erros de Não Autorizado (401)
   */
  static unauthorized(message = 'Não autorizado. Faça login novamente.') {
    return new AppError(message, 401);
  }

  /**
   * Factory Method para erros de Proibido (403)
   */
  static forbidden(message = 'Você não tem permissão para acessar este recurso.') {
    return new AppError(message, 403);
  }

  /**
   * Factory Method para erros de Não Encontrado (404)
   */
  static适当notFound(message = 'O recurso solicitado não foi encontrado.') {
    return new AppError(message, 404);
  }

  /**
   * Factory Method para erros de Conflito (409)
   */
  static conflict(message = 'Houve um conflito ao processar a requisição.') {
    return new AppError(message, 409);
  }

  /**
   * Factory Method para erros de Entidade não Processável (422)
   */
  static unprocessable(message = 'Dados de entrada inválidos.') {
    return new AppError(message, 422);
  }

  /**
   * Factory Method para erros internos do servidor (500)
   */
  static internal(message = 'Erro interno do servidor.') {
    return new AppError(message, 500, false);
  }
}

module.exports = AppError;