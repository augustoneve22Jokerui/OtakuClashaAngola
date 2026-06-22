const BaseService = require('../../core/base/BaseService');
const authRepository = require('./auth.repository');
const TokenHelper = require('../../utils/TokenHelper');
const AppError = require('../../core/errors/AppError');
const logger = require('../../config/logger');
const emailService = require('../../services/notification/EmailService');

/**
 * AuthService - Orquestrador de fluxos de autenticação, segurança e identidade.
 */
class AuthService extends BaseService {
  constructor() {
    super(authRepository);
  }

  /**
   * Realiza o registro de um novo usuário.
   * @param {Object} userData - { email, password, username, full_name }
   */
  async register(userData) {
    try {
      // 1. Verifica conflitos de e-mail e username
      const { emailExists, usernameExists } = await this.repository.checkConflicts(
        userData.email,
        userData.username
      );

      if (emailExists) throw AppError.conflict('Este e-mail já está em uso.');
      if (usernameExists) throw AppError.conflict('Este nome de usuário já está em uso.');

      // 2. Cria o usuário no Supabase Auth
      const user = await this.repository.createSupabaseUser(userData);

      // 3. Envia e-mail de boas-vindas (assíncrono)
      emailService.sendWelcomeEmail(userData.email, userData.username).catch(err => {
        logger.error(`[AuthService] Falha ao enviar e-mail de boas-vindas: ${err.message}`);
      });

      // 4. Gera tokens iniciais para o usuário já entrar logado
      const accessToken = TokenHelper.generateAccessToken({
        id: user.id,
        role: 'USER',
        email: user.email,
        username: userData.username
      });

      const refreshToken = TokenHelper.generateRefreshToken(user.id);

      return {
        user: {
          id: user.id,
          email: user.email,
          username: userData.username,
          role: 'USER'
        },
        tokens: {
          accessToken,
          refreshToken
        }
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error(`[AuthService] Erro no registro: ${error.message}`);
      throw AppError.internal('Erro ao processar cadastro de usuário.');
    }
  }

  /**
   * Realiza o login do usuário.
   */
  async login(email, password) {
    try {
      // 1. Autentica via Supabase
      const authData = await this.repository.signInWithEmail(email, password);
      
      // 2. Busca o perfil público para obter a Role e Username
      const profile = await this.repository.findById(authData.user.id);

      if (!profile) {
        throw AppError.notFound('Perfil de usuário não encontrado.');
      }

      // 3. Gera tokens locais com as permissões corretas
      const accessToken = TokenHelper.generateAccessToken({
        id: profile.id,
        role: profile.role,
        email: authData.user.email,
        username: profile.username
      });

      const refreshToken = TokenHelper.generateRefreshToken(profile.id);

      logger.info(`[AuthService] Usuário logado: ${profile.username}`);

      return {
        user: {
          id: profile.id,
          username: profile.username,
          role: profile.role,
          avatarUrl: profile.avatar_url,
          xp: profile.xp,
          level: profile.level
        },
        tokens: {
          accessToken,
          refreshToken
        }
      };
    } catch (error) {
      logger.error(`[AuthService] Erro na tentativa de login: ${error.message}`);
      throw AppError.unauthorized('E-mail ou senha incorretos.');
    }
  }

  /**
   * Renova o Access Token utilizando um Refresh Token válido.
   */
  async refreshSession(refreshToken) {
    try {
      // 1. Valida o token
      const decoded = TokenHelper.verifyRefreshToken(refreshToken);
      
      // 2. Busca o perfil atualizado
      const profile = await this.repository.findById(decoded.sub);
      if (!profile) throw AppError.unauthorized('Usuário não encontrado.');

      // 3. Gera novo Access Token
      const accessToken = TokenHelper.generateAccessToken({
        id: profile.id,
        role: profile.role,
        username: profile.username
      });

      return { accessToken };
    } catch (error) {
      logger.warn(`[AuthService] Falha no refresh de token: ${error.message}`);
      throw AppError.unauthorized('Sessão expirada. Por favor, faça login novamente.');
    }
  }

  /**
   * Inicia o fluxo de recuperação de senha.
   */
  async forgotPassword(email) {
    try {
      const resetLink = await this.repository.generatePasswordResetLink(email);
      
      // Extrai o token do link gerado pelo Supabase ou envia o link direto
      await emailService.sendPasswordResetEmail(email, resetLink);
      
      return { message: 'Se o e-mail existir em nossa base, as instruções foram enviadas.' };
    } catch (error) {
      logger.error(`[AuthService] Erro no forgotPassword: ${error.message}`);
      // Por segurança, não informamos se o e-mail existe ou não
      return { message: 'Se o e-mail existir em nossa base, as instruções foram enviadas.' };
    }
  }

  /**
   * Redefine a senha de um usuário.
   */
  async resetPassword(userId, newPassword) {
    try {
      await this.repository.adminUpdatePassword(userId, newPassword);
      logger.info(`[AuthService] Senha resetada para o usuário: ${userId}`);
      return { success: true };
    } catch (error) {
      logger.error(`[AuthService] Erro ao resetar senha: ${error.message}`);
      throw AppError.internal('Não foi possível redefinir sua senha.');
    }
  }
}

module.exports = new AuthService();