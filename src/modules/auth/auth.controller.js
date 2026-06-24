const BaseController = require('../../core/base/BaseController');
const authService = require('./auth.service');

/**
 * AuthController - Controlador para gestão de autenticação, registro e recuperação de conta.
 */
class AuthController extends BaseController {
  constructor() {
    super();
  }

  /**
   * Registra um novo usuário no sistema.
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

    return this.created(res, result, 'Usuário registrado com sucesso.');
  }

  /**
   * Realiza a autenticação do usuário.
   * POST /api/v1/auth/login
   */
  async login(req, res) {
    const { email, password } = req.body;

    const result = await authService.login(email, password);

    return this.success(res, result, 'Autenticação realizada com sucesso.');
  }

  /**
   * Renova o token de acesso utilizando um Refresh Token.
   * POST /api/v1/auth/refresh
   */
  async refresh(req, res) {
    const { refreshToken } = req.body;

    const result = await authService.refreshSession(refreshToken);

    return this.success(res, result, 'Token renovado com sucesso.');
  }

  /**
   * Solicita link para recuperação de senha.
   * POST /api/v1/auth/forgot-password
   */
  async forgotPassword(req, res) {
    const { email } = req.body;

    const result = await authService.forgotPassword(email);

    return this.success(res, result, 'Instruções de recuperação enviadas para o e-mail informado.');
  }

  /**
   * Redefine a senha do usuário após verificação.
   * POST /api/v1/auth/reset-password
   */
  async resetPassword(req, res) {
    // O userId deve ser extraído de um token de reset verificado anteriormente ou via admin
    const { userId, newPassword } = req.body;

    const result = await authService.resetPassword(userId, newPassword);

    return this.success(res, result, 'Sua senha foi redefinida com sucesso.');
  }

  /**
   * Obtém os dados do usuário autenticado (Check Session).
   * GET /api/v1/auth/me
   */
  async me(req, res) {
    // req.user é injetado pelo authMiddleware
    const profile = await authService.repository.findById(req.user.id);
    
    return this.success(res, profile, 'Dados da sessão atual recuperados.');
  }
}

module.exports = new AuthController();