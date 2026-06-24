const validationMiddleware = require('../../middlewares/validation.middleware');
const AuthSchema = require('../../validators/auth.schema');

/**
 * AuthValidator - Middlewares de validação específicos para o módulo de Autenticação.
 * Encapsula o validationMiddleware com os esquemas Zod correspondentes.
 */
const AuthValidator = {
  /**
   * Valida os dados para criação de nova conta.
   */
  validateRegister: validationMiddleware({
    body: AuthSchema.register
  }),

  /**
   * Valida as credenciais para login.
   */
  validateLogin: validationMiddleware({
    body: AuthSchema.login
  }),

  /**
   * Valida o token para renovação de sessão (Refresh Token).
   */
  validateRefresh: validationMiddleware({
    body: AuthSchema.refreshToken
  }),

  /**
   * Valida o e-mail para solicitação de recuperação de senha.
   */
  validateForgotPassword: validationMiddleware({
    body: AuthSchema.forgotPassword
  }),

  /**
   * Valida os dados para redefinição final de senha.
   */
  validateResetPassword: validationMiddleware({
    body: AuthSchema.resetPassword
  }),

  /**
   * Valida os dados para atualização parcial do perfil.
   */
  validateUpdateProfile: validationMiddleware({
    body: AuthSchema.updateProfile
  })
};

module.exports = AuthValidator;