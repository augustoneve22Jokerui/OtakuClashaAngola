/**
 * 🔐 OTAKU CLASH ANGOLA - AUTH SERVICE (ULTRA RESILIENT)
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Orquestrador de identidade e sessões.
 */

const BaseService = require('../../core/base/BaseService');
const authRepository = require('./auth.repository');
const TokenHelper = require('../../utils/TokenHelper');
const AppError = require('../../core/errors/AppError');
const logger = require('../../config/logger');
const emailService = require('../../services/notification/EmailService');

class AuthService extends BaseService {
  constructor() {
    super(authRepository);
  }

  /**
   * 🔥 LOGIN COM AUTO-HEALING DE PERFIL
   * Autentica no Supabase e garante integridade do perfil local.
   */
  async login(email, password) {
    try {
      logger.info(`[AuthService] Iniciando autenticação para: ${email}`);

      // 1. Autenticação externa no Supabase Auth
      const authData = await this.repository.signInWithEmail(email, password);

      if (!authData || !authData.user) {
        logger.error(`[AuthService] Resposta inválida do provedor Auth para: ${email}`);
        throw AppError.unauthorized('Identidade não verificada pelo provedor externo.');
      }

      const userId = authData.user.id;

      // 2. Recuperação do Perfil Local (public.profiles)
      let profile = await this.repository.findById(userId);

      // 3. AUTO-HEALING: Se o perfil local não existe (falha de trigger), cria agora
      if (!profile) {
        logger.warn(`[AuthService] Perfil local ausente para ${userId}. Executando Auto-Healing.`);
        
        const fallbackUsername = authData.user.user_metadata?.username || `otaku_${userId.substring(0, 5)}`;
        const fallbackFullName = authData.user.user_metadata?.full_name || 'Membro Otaku';

        profile = await this.repository.createProfileSafely({
          id: userId,
          username: fallbackUsername,
          full_name: fallbackFullName,
          role: 'USER' // Role padrão inicial
        });
      }

      // 4. VERIFICAÇÃO DE PRIVILÉGIO ADMINISTRATIVO MESTRE
      // Força a role ADMIN se o e-mail for o configurado no script de setup
      if (email === 'admin@otakuclashangola.com' && profile.role !== 'ADMIN') {
        logger.info(`[AuthService] Elevando privilégios para Admin Mestre: ${email}`);
        profile = await this.repository.update(userId, { role: 'ADMIN' });
      }

      // 5. GERAÇÃO DE TOKENS JWT LOCAIS
      // Injetamos as claims exatas que o middleware de auth espera
      const accessToken = TokenHelper.generateAccessToken({
        id: profile.id,
        role: profile.role,
        email: authData.user.email,
        username: profile.username
      });

      const refreshToken = TokenHelper.generateRefreshToken(profile.id);

      logger.info(`[AuthService] Login bem-sucedido: ${profile.username} [${profile.role}]`);

      // 6. Estrutura de retorno compatível com DTO e Frontend
      return {
        user: {
          id: profile.id,
          username: profile.username,
          email: authData.user.email,
          role: profile.role,
          avatarUrl: profile.avatar_url,
          xp: parseInt(profile.xp || 0),
          level: parseInt(profile.level || 1)
        },
        tokens: {
          accessToken,
          refreshToken
        }
      };

    } catch (error) {
      logger.error(`[AuthService] Falha na autenticação [${email}]: ${error.message}`);

      // Tratamento de erros específicos do Supabase Auth
      if (error.status === 400 || error.message.includes('invalid_credentials')) {
        throw AppError.unauthorized('Credenciais inválidas. Verifique seu e-mail e senha.');
      }
      
      if (error.message.includes('Email not confirmed')) {
        throw AppError.unauthorized('Sua conta ainda não foi confirmada. Verifique seu e-mail.');
      }

      throw error instanceof AppError ? error : AppError.internal('Falha interna ao processar login.');
    }
  }

  /**
   * 📝 REGISTRO DE USUÁRIO
   */
  async register(userData) {
    try {
      // 1. Verifica conflitos locais antes de chamar o Supabase
      const { usernameExists } = await this.repository.checkConflicts(null, userData.username);
      
      if (usernameExists) {
        throw AppError.conflict('Este nome de usuário já está sendo utilizado.');
      }

      // 2. Registro no Supabase Auth via Admin SDK (bypass de confirmação se necessário)
      const { data, error } = await this.repository.supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            username: userData.username,
            full_name: userData.full_name
          }
        }
      });

      if (error) {
        if (error.message.includes('User already registered')) {
          throw AppError.conflict('Este endereço de e-mail já está em uso.');
        }
        throw new Error(error.message);
      }

      // 3. Envio de e-mail de boas-vindas em background
      emailService.sendWelcomeEmail(userData.email, userData.username).catch(err => {
        logger.error(`[AuthService:Email] Falha no envio de boas-vindas: ${err.message}`);
      });

      return {
        id: data.user.id,
        email: data.user.email,
        username: userData.username,
        role: 'USER'
      };

    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error(`[AuthService] Erro no registro: ${error.message}`);
      throw AppError.internal('Não foi possível completar o cadastro neste momento.');
    }
  }

  /**
   * 🔄 RENOVAÇÃO DE SESSÃO (REFRESH TOKEN)
   */
  async refreshSession(refreshToken) {
    try {
      // 1. Valida o refresh token
      const decoded = TokenHelper.verifyRefreshToken(refreshToken);
      
      // 2. Busca o perfil atualizado para carregar a role correta
      const profile = await this.repository.findById(decoded.sub);
      
      if (!profile) {
        throw AppError.unauthorized('Sessão inválida. Usuário não encontrado.');
      }

      // 3. Gera novo access token com claims atualizadas
      const accessToken = TokenHelper.generateAccessToken({
        id: profile.id,
        role: profile.role,
        username: profile.username
      });

      return {
        accessToken,
        tokenType: 'Bearer'
      };
    } catch (error) {
      logger.warn(`[AuthService:Refresh] Falha ao renovar token: ${error.message}`);
      throw AppError.unauthorized('Sessão expirada. Por favor, faça login novamente.');
    }
  }
}

module.exports = new AuthService();