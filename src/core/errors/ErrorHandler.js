/**
 * 🛠️ OTAKU CLASH ANGOLA - ERROR HANDLER CENTRAL
 * Versão: 2.1.4 - Advanced Logging & Precision Error Shield
 * Descrição: Middleware centralizado de gerenciamento, normalização, logging e respostas de exceções.
 */

const logger = require('../../config/logger');
const AppError = require('./AppError');
const env = require('../../config/env');

class ErrorHandler {
  /**
   * Converte erros desconhecidos, nativos ou de bibliotecas em AppError estruturado.
   * Aplica também o patch de segurança contra mensagens vazias "{}" do Provedor Auth.
   */
  static handleError(err) {
    let error = err;

    // 1. Trata erros de validação do Zod
    if (err.name === 'ZodError') {
      const message = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      error = new AppError(`Erro de validação: ${message}`, 400);
      return error;
    }

    // 2. Trata erros específicos de restrição do PostgreSQL / Supabase Database
    if (err.code === '23505') { // Unique violation
      error = new AppError('Este registro já existe em nosso sistema.', 409);
      return error;
    }

    if (err.code === '23503') { // Foreign key violation
      error = new AppError('Operação inválida: Registro pai não encontrado.', 400);
      return error;
    }

    // 3. Normalização de instâncias genéricas e proteção Anti-Object-Null
    if (!(error instanceof AppError)) {
      const statusCode = error.statusCode || error.status || 500;
      let message = error.message || 'Erro interno do servidor';

      // 🔥 FIX DEFINITIVO: Captura objetos de erro vazios ou strings serializadas do Supabase Auth
      if (message === '{}' || (typeof message === 'object' && Object.keys(message).length === 0)) {
        message = 'Credenciais Inválidas ou Erro no Provedor Auth';
      }

      error = new AppError(message, statusCode, false, err.stack);
    } else {
      // 🔥 Mesmo que já seja um AppError, aplicamos o fallback de segurança na mensagem se necessário
      if (error.message === '{}' || (typeof error.message === 'object' && Object.keys(error.message).length === 0)) {
        error.message = 'Credenciais Inválidas ou Erro no Provedor Auth';
      }
    }

    return error;
  }

  /**
   * Middleware para Express (err, req, res, next)
   */
  static middleware(err, req, res, next) {
    // Normaliza o erro recebido utilizando as regras de negócio e infraestrutura
    const error = ErrorHandler.handleError(err);

    // Logging estratégico baseado no tipo, código de status HTTP e severidade do erro
    if (error.statusCode === 401 || error.statusCode === 400 || error.statusCode === 403) {
      // Log como aviso operacional (erros controlados de validação ou de autenticação)
      logger.warn(`[Auth-Warning] ${req.method} ${req.url} - ${error.message}`);
    } else if (error.statusCode >= 500) {
      // Log como erro crítico (erros inesperados ou falhas internas de servidor)
      logger.error(`[Critical-Error] ${req.method} ${req.url} - ${error.message}`, { 
        stack: error.stack 
      });
    } else {
      // Outros erros operacionais mapeados (ex: 404, 409, 422)
      logger.warn(`[Operational-Error] ${req.method} ${req.url} - Status ${error.statusCode} - ${error.message}`);
    }

    // Estruturação da resposta padrão HTTP JSON entregue ao cliente frontend
    const response = {
      status: 'error',
      message: error.message,
      ...(env.NODE_ENV === 'development' && { stack: error.stack })
    };

    // Injeta detalhes granulares adicionais se a origem do erro for um ZodError mapeado
    if (err.name === 'ZodError') {
      response.errors = err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }));
    }

    return res.status(error.statusCode).json(response);
  }

  /**
   * Captura erros em rotas assíncronas (Wrapper elegante para eliminar blocos try/catch repetitivos)
   */
  static catchAsync(fn) {
    return (req, res, next) => {
      fn(req, res, next).catch(next);
    };
  }
}

module.exports = ErrorHandler;
