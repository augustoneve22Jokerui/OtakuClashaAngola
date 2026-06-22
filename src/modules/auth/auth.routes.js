const express = require('express');
const authController = require('./auth.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const validationMiddleware = require('../../middlewares/validation.middleware');
const { rateLimiterAuth } = require('../../middlewares/rateLimiter.middleware');
const AuthSchema = require('../../validators/auth.schema');

const router = express.Router();

/**
 * Registro de Novo Usuário
 * POST /api/v1/auth/register
 */
router.post(
  '/register',
  rateLimiterAuth,
  validationMiddleware({ body: AuthSchema.register }),
  authController.safe(authController.register)
);

/**
 * Autenticação de Usuário (Login)
 * POST /api/v1/auth/login
 */
router.post(
  '/login',
  rateLimiterAuth,
  validationMiddleware({ body: AuthSchema.login }),
  authController.safe(authController.login)
);

/**
 * Renovação de Token (Refresh Token)
 * POST /api/v1/auth/refresh
 */
router.post(
  '/refresh',
  validationMiddleware({ body: AuthSchema.refreshToken }),
  authController.safe(authController.refresh)
);

/**
 * Solicitação de Recuperação de Senha
 * POST /api/v1/auth/forgot-password
 */
router.post(
  '/forgot-password',
  validationMiddleware({ body: AuthSchema.forgotPassword }),
  authController.safe(authController.forgotPassword)
);

/**
 * Redefinição de Senha
 * POST /api/v1/auth/reset-password
 */
router.post(
  '/reset-password',
  validationMiddleware({ body: AuthSchema.resetPassword }),
  authController.safe(authController.resetPassword)
);

/**
 * Obter dados do usuário logado (Check Session)
 * GET /api/v1/auth/me
 */
router.get(
  '/me',
  authMiddleware,
  authController.safe(authController.me)
);

module.exports = router;