/**
 * 🚀 OTAKU CLASH ANGOLA - AUTH SERVICE (ULTRA FINAL)
 * Versão: Ultra Mega Final - Enterprise Grade
 * Descrição: Orquestrador de identidade. Gerencia login, tokens e permissões.
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
   * 🛡️ LOGIN INFALÍVEL
   * Realiza a autenticação e garante que o perfil administrativo existe.
   */
  async login(email, password) {
    try {
      logger.info(`[AuthService] Tentativa de login iniciada para: ${email}`);

      // 1. Autenticação no Supabase Auth
      // O repository usa o supabaseAdmin para garantir bypass de restrições menores
      const authData = await this.repository.signInWithEmail(email, password);

      if (!authData || !authData.user) {
        logger.error(`[AuthService] Supabase Auth não retornou dados de usuário para: ${email}`);
        throw AppError.unauthorized('Erro crítico de identidade no provedor externo.');
      }

      const userId = authData.user.id;
      logger.info(`[AuthService] Usuário autenticado no Auth. ID: ${userId}`);

      // 2. Busca do Perfil no Banco de Dados Local (public.profiles)
      let profile = await this.repository.findById(userId);

      // 3. FALLBACK DE EMERGÊNCIA: Se o usuário existe no Auth mas o trigger falhou em criar o profile
      if (!profile) {
        logger.warn(`[AuthService] Profile não encontrado para usuário existente. Criando perfil de emergência para ${userId}`);
        
        profile = await this.repository.create({
          id: userId,
          username: authData.user.user_metadata?.username || `otaku_${userId.substring(0, 5)}`,
          full_name: authData.user.user_metadata?.full_name || 'Usuário Otaku',
          role: 'USER', // Valor padrão, será verificado abaixo
          xp: 0,
          level: 1
        });
      }

      // 4. VALIDAÇÃO DE ACESSO ADMINISTRATIVO
      // Se o email for o admin principal definido no script SQL, garantimos a role ADMIN
      if (email === 'admin@otakuclashangola.com' && profile.role !== 'ADMIN') {
        logger.warn(`[AuthService] Corrigindo role de super admin para ${email}`);
        profile = await this.repository.update(userId, { role: 'ADMIN' });
      }

      // 5. GERAÇÃO DE TOKENS JWT LOCAIS
      // Injetamos a ROLE real do banco de dados no token para o authMiddleware validar
      const accessToken = TokenHelper.generateAccessToken({
        id: profile.id,
        role: profile.role,
        email: authData.user.email,
        username: profile.username
      });

      const refreshToken = TokenHelper.generateRefreshToken(profile.id);

      logger.info(`[AuthService] Login concluído com sucesso. Role: ${profile.role}`);

      // Retorna estrutura compatível com AuthDTO e Frontend
      return {
        user: {
          id: profile.id,
          username: profile.username,
          role: profile.role,
          avatarUrl: profile.avatar_url,
          xp: parseInt(profile.xp),
          level: parseInt(profile.level)
        },
        tokens: {
          accessToken,
          refreshToken
        }
      };

    } catch (error) {
      // Log detalhado para depuração no Render
      logger.error(`[AuthService] Falha no Login [${email}]: ${error.message}`);

      // Tratamento específico de erro 401 do Supabase (Invalid login credentials)
      if (error.status === 400 || error.status === 401 || error.message.includes('invalid_credentials')) {
        throw AppError.unauthorized('As credenciais fornecidas são inválidas ou o utilizador não existe.');
      }

      if (error.message.includes('Email not confirmed')) {
        throw AppError.unauthorized('Por favor, confirme o seu e-mail antes de aceder ao painel.');
      }

      throw error instanceof AppError ? error : AppError.internal('Erro interno ao processar autenticação.');
    }
  }

  /**
   * 📝 REGISTRO DE USUÁRIO
   */
  async register(userData) {
    try {
      const { emailExists, usernameExists } = await this.repository.checkConflicts(
        userData.email,
        userData.username
      );

      if (emailExists) throw AppError.conflict('Este e-mail já está em uso.');
      if (usernameExists) throw AppError.conflict('Este nome de usuário já está em uso.');

      const user = await this.repository.createSupabaseUser(userData);

      emailService.sendWelcomeEmail(userData.email, userData.username).catch(err => {
        logger.error(`[AuthService] Falha ao enviar e-mail de boas-vindas: ${err.message}`);
      });

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
   * 🔄 RENOVAÇÃO DE SESSÃO
   */
  async refreshSession(refreshToken) {
    try {
      const decoded = TokenHelper.verifyRefreshToken(refreshToken);
      const profile = await this.repository.findById(decoded.sub);
      
      if (!profile) throw AppError.unauthorized('Sessão inválida: Usuário não localizado.');

      const accessToken = TokenHelper.generateAccessToken({
        id: profile.id,
        role: profile.role,
        username: profile.username
      });

      return { accessToken };
    } catch (error) {
      logger.warn(`[AuthService] Falha no refresh: ${error.message}`);
      throw AppError.unauthorized('Sessão expirada. Por favor, faça login novamente.');
    }
  }
}

module.exports = new AuthService();
