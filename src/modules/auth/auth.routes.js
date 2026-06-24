/**
 * 🛣️ OTAKU CLASH ANGOLA - AUTH ROUTES
 * Versão: 2.5.0 - Enterprise Secured "Full-Full"
 * Descrição: Definição de endpoints para ciclo de vida de identidade e acesso.
 */

const express = require('express');
const authController = require('./auth.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const validationMiddleware = require('../../middlewares/validation.middleware');
const { rateLimiterAuth } = require('../../middlewares/rateLimiter.middleware');
const AuthSchema = require('../../validators/auth.schema');

const router = express.Router();

/**
 * ==================================================
 * 🔓 ROTAS PÚBLICAS (SEM TOKEN)
 * Protegidas por Rate Limit para evitar abusos.
 * ==================================================
 */

/**
 * 🎟️ LOGIN DE UTILIZADOR
 * POST /api/v1/auth/login
 */
router.post(
  '/login',
  rateLimiterAuth, // 10 tentativas por hora
  validationMiddleware({ body: AuthSchema.login }),
  authController.safe(authController.login)
);

/**
 * 📝 REGISTO DE NOVO PLAYER
 * POST /api/v1/auth/register
 */
router.post(
  '/register',
  rateLimiterAuth,
  validationMiddleware({ body: AuthSchema.register }),
  authController.safe(authController.register)
);

/**
 * 🔄 RENOVAÇÃO DE SESSÃO (REFRESH TOKEN)
 * POST /api/v1/auth/refresh
 */
router.post(
  '/refresh',
  validationMiddleware({ body: AuthSchema.refreshToken }),
  authController.safe(authController.refresh)
);

/**
 * 🔑 SOLICITAR RECUPERAÇÃO DE SENHA
 * POST /api/v1/auth/forgot-password
 */
router.post(
  '/forgot-password',
  validationMiddleware({ body: AuthSchema.forgotPassword }),
  authController.safe(authController.forgotPassword)
);

/**
 * 🛠️ REDEFINIR SENHA (VIA TOKEN DE RESET)
 * POST /api/v1/auth/reset-password
 */
router.post(
  '/reset-password',
  validationMiddleware({ body: AuthSchema.resetPassword }),
  authController.safe(authController.resetPassword)
);

/**
 * ==================================================
 * 🔒 ROTAS PROTEGIDAS (REQUEREM JWT)
 * ==================================================
 */

/**
 * 👤 CHECK SESSÃO / MEUS DADOS
 * GET /api/v1/auth/me
 */
router.get(
  '/me',
  authMiddleware, // Apenas este endpoint exige o token Bearer
  authController.safe(authController.me)
);

module.exports = router;
