const cacheProvider = require('../config/cache');
const logger = require('../config/logger');
const env = require('../config/env');

/**
 * cacheMiddleware - Middleware para cache de respostas GET no Redis.
 * 
 * @param {number} ttl - Tempo de vida do cache em segundos (padrão 60s).
 * @param {boolean} isPrivate - Se true, inclui o ID do usuário na chave do cache.
 */
const cacheMiddleware = (ttl = 60, isPrivate = false) => {
  return async (req, res, next) => {
    // 1. Apenas faz cache de requisições GET
    if (req.method !== 'GET') {
      return next();
    }

    // 2. Permite bypass do cache via header para desenvolvimento ou admin
    if (req.headers['x-no-cache'] === 'true') {
      return next();
    }

    // 3. Gera uma chave única baseada na URL e parâmetros
    let cacheKey = `cache:${req.originalUrl || req.url}`;

    // 4. Se o cache for privado, anexa o ID do usuário autenticado
    if (isPrivate && req.user && req.user.id) {
      cacheKey = `cache:user:${req.user.id}:${req.originalUrl || req.url}`;
    }

    try {
      // 5. Tenta recuperar do cache
      const cachedResponse = await cacheProvider.get(cacheKey);

      if (cachedResponse) {
        if (env.NODE_ENV === 'development') {
          logger.debug(`[Cache] HIT: ${cacheKey}`);
        }
        res.setHeader('X-Cache', 'HIT');
        return res.status(200).json(cachedResponse);
      }

      if (env.NODE_ENV === 'development') {
        logger.debug(`[Cache] MISS: ${cacheKey}`);
      }

      // 6. Se não houver cache, intercepta o res.send para salvar a resposta futura
      const originalSend = res.send;

      res.send = function (body) {
        // Apenas faz cache se o status for 2xx
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const dataToCache = JSON.parse(body);
            cacheProvider.set(cacheKey, dataToCache, ttl).catch(err => {
              logger.error(`[Cache] Falha ao salvar no Redis: ${err.message}`);
            });
            res.setHeader('X-Cache', 'MISS');
          } catch (e) {
            // Se não for JSON, não fazemos cache neste sistema enterprise
            logger.warn(`[Cache] Resposta não-JSON detectada para ${cacheKey}. Ignorando cache.`);
          }
        }
        
        return originalSend.apply(res, arguments);
      };

      next();
    } catch (error) {
      logger.error(`[CacheMiddleware] Erro crítico: ${error.message}`);
      // Em caso de erro no Redis, seguimos a requisição sem cache (fail-safe)
      next();
    }
  };
};

module.exports = cacheMiddleware;