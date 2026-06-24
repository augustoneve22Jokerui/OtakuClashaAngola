/**
 * 🔐 OTAKU CLASH ANGOLA - AUTH CONTROLLER
 * Versão: 2.5.0 - Enterprise "Full-Full" Edition
 * Descrição: Ponto de entrada para autenticação, registro e gestão de sessões.
 */

const BaseController = require('../../core/base/BaseController');
const authService = require('./auth.service');
const logger = require('../../config/logger');

class AuthController extends BaseController {
  constructor() {
    super();
  }

  /**
   * 🎟️ LOGIN ADMINISTRATIVO / PLAYER
   * POST /api/v1/auth/login
   */
  async login(req, res) {
    const { email, password } = req.body;

    logger.debug(`[AuthController:Login] Tentativa de acesso para: ${email}`);

    // O Service gerencia o Supabase + Auto-Healing do Perfil Local
    const authResult = await authService.login(email, password);

    /**
     * O método success da BaseController retorna:
     * {
     *   status: 'success',
     *   message: '...',
     *   data: { user: {...}, tokens: {...} }
     * }
     */
    return this.success(
      res, 
      authResult, 
      'Autenticação realizada com sucesso. Bem-vindo ao Otaku Clash!'
    );
  }

  /**
   * 📝 REGISTO DE NOVO UTILIZADOR
   * POST /api/v1/auth/register
   */
  async register(req, res) {
    const userData = {
      email: req.body.email,
      password: req.body.password,
      username: req.body.username,
      full_name: req.body.full_name
    };

    const result = await authService.register(userData);

    return this.created(
      res, 
      result, 
      'Conta criada com sucesso! Verifique o seu e-mail para confirmação.'
    );
  }

  /**
   * 🔄 RENOVAÇÃO DE TOKEN (REFRESH)
   * POST /api/v1/auth/refresh
   */
  async refresh(req, res) {
    const { refreshToken } = req.body;

    const result = await authService.refreshSession(refreshToken);

    return this.success(
      res, 
      result, 
      'Sessão renovada com sucesso.'
    );
  }

  /**
   * 👤 VERIFICAÇÃO DE SESSÃO ATUAL (ME)
   * GET /api/v1/auth/me
   */
  async me(req, res) {
    // req.user é injetado pelo authMiddleware
    const userId = req.user.id;
    
    // Busca o perfil completo para garantir que o frontend tenha dados atualizados
    const profile = await authService.repository.findById(userId);
    
    if (!profile) {
      const AppError = require('../../core/errors/AppError');
      throw AppError.unauthorized('Perfil de utilizador não encontrado.');
    }

    return this.success(
      res, 
      profile, 
      'Dados da sessão recuperados.'
    );
  }

  /**
   * 🔑 SOLICITAÇÃO DE RECUPERAÇÃO DE SENHA
   * POST /api/v1/auth/forgot-password
   */
  async forgotPassword(req, res) {
    const { email } = req.body;

    // Lógica delegada ao Supabase via Service
    const { supabaseAdmin } = require('../../config/supabase');
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email);

    if (error) {
      logger.error(`[Auth:Forgot] Erro: ${error.message}`);
      // Em segurança, não confirmamos se o e-mail existe ou não
    }

    return this.success(
      res, 
      null, 
      'Se o e-mail estiver registado, as instruções de recuperação foram enviadas.'
    );
  }

  /**
   * 🛠️ REDEFINIÇÃO FINAL DE SENHA
   * POST /api/v1/auth/reset-password
   */
  async resetPassword(req, res) {
    const { userId, newPassword } = req.body;
    
    // Apenas ADMIN ou utilizador validado por token de reset (lógica simplificada aqui)
    const result = await authService.repository.adminUpdatePassword(userId, newPassword);

    return this.success(res, null, 'Senha redefinida com sucesso.');
  }
}

module.exports = new AuthController();
