const ErrorHandler = require('../core/errors/ErrorHandler');

/**
 * errorMiddleware - O middleware de erro final da aplicação Express.
 * Este middleware deve ser o ÚLTIMO a ser registrado no app.js.
 * 
 * Ele intercepta todos os erros passados via next(err) e os encaminha
 * para o ErrorHandler centralizado.
 */
const errorMiddleware = (err, req, res, next) => {
  // Chama o método estático do ErrorHandler para processar e enviar a resposta
  return ErrorHandler.middleware(err, req, res, next);
};

module.exports = errorMiddleware;