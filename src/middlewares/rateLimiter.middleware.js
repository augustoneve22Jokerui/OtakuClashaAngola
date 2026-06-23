const rateLimit = require('express-rate-limit');
const AppError = require('../core/errors/AppError');
const logger = require('../config/logger');

/**
 * rateLimiterGlobal - Proteção para todas as rotas da API.
 * Limita o uso geral para evitar abusos de crawler ou scripts maliciosos.
 */
const rateLimiterGlobal = rateLimit({
  windowMs: 15 * 60 * 1000, // Janela de 15 minutos
  max: 100, // Limite de 100 requisições por IP por janela
  standardHeaders: true, // Retorna info de limite nos headers RateLimit-*
  legacyHeaders: false, // Desabilita os headers X-RateLimit-*
  handler: (req, res, next) => {
    logger.warn(`[RateLimit] Limite global atingido pelo IP: ${req.ip}`);
    next(new AppError('Muitas requisições vindas deste IP. Tente novamente em 15 minutos.', 429));
  },
});

/**
 * rateLimiterAuth - Proteção crítica para rotas de autenticação.
 * Muito mais restritivo para impedir ataques de força bruta em senhas.
 */
const rateLimiterAuth = rateLimit({
  windowMs: 60 * 60 * 1000, // Janela de 1 hora
  max: 10, // Apenas 10 tentativas de login/cadastro por hora por IP
  message: 'Muitas tentativas de login. Por segurança, sua conta está temporariamente bloqueada para este IP.',
  handler: (req, res, next) => {
    logger.error(`[RateLimit-Auth] Tentativa de força bruta detectada no IP: ${req.ip}`);
    next(new AppError('Limite de tentativas de autenticação excedido. Tente novamente em uma hora.', 429));
  },
});

module.exports = {
  rateLimiterGlobal,
  rateLimiterAuth
};