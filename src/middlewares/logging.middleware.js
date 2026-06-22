const morgan = require('morgan');
const logger = require('../config/logger');
const env = require('../config/env');

/**
 * Define o formato do log baseado no ambiente
 * - 'dev': Colorido e simples para desenvolvimento
 * - 'combined': Padrão Apache para produção (mais detalhado)
 */
const format = env.NODE_ENV === 'development' ? 'dev' : 'combined';

/**
 * loggingMiddleware - Interceptor de requisições HTTP para logs automáticos.
 * Utiliza o stream do winston para garantir centralização dos logs.
 */
const loggingMiddleware = morgan(format, {
  stream: logger.stream,
  skip: (req, res) => {
    // Opcional: Ignorar logs de health check para não poluir os arquivos de produção
    if (req.url === '/health' || req.url === '/api/v1/health') {
      return true;
    }
    // Em produção, podemos querer pular logs de status 2xx/3xx se o tráfego for muito alto
    // return env.NODE_ENV === 'production' && res.statusCode < 400;
    return false;
  }
});

/**
 * Middleware Adicional para Logging de Erros de Payload
 * Útil para debugar quando o body enviado pelo cliente está malformado.
 */
const payloadLogger = (req, res, next) => {
  if (env.NODE_ENV === 'development' && req.body && Object.keys(req.body).length > 0) {
    logger.debug(`[Payload] ${req.method} ${req.url}:`, { body: req.body });
  }
  next();
};

module.exports = {
  loggingMiddleware,
  payloadLogger
};