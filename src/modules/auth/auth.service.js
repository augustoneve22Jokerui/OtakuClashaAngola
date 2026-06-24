/**
 * 🔐 OTAKU CLASH ANGOLA - AUTH SERVICE (ULTRA RESILIENT)
 * Versão: 2.1.0 - Resilient Auth Flow
 * Descrição: Orquestrador de identidade, sessões e auto-healing de perfis locais.
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
     * Autentica no Supabase com captura resiliente de erros e garante integridade do perfil local.
     */
    async login(email, password) {
        try {
            logger.info(`[AuthService] Tentativa de login: ${email}`);

            // 1. Autenticação no Supabase Auth externa com captura isolada
            let authData;
            try {
                authData = await this.repository.signInWithEmail(email, password);
            } catch (supabaseErr) {
                // Tratamento específico de erros mapeados do Supabase Auth
                const errMsg = supabaseErr.message || '';
                logger.warn(`[AuthService:Denied] ${email} - Razão: ${errMsg}`);

                if (supabaseErr.status === 400 || errMsg.includes('invalid_credentials')) {
                    throw AppError.unauthorized('Credenciais inválidas. Verifique seu e-mail e senha.');
                }
                
                if (errMsg.includes('Email not confirmed')) {
                    throw AppError.unauthorized('Sua conta ainda não foi confirmada. Verifique seu e-mail.');
                }

                throw AppError.unauthorized(errMsg || 'Credenciais inválidas.');
            }

            if (!authData || !authData.user) {
                throw AppError.unauthorized('Usuário não localizado no provedor.');
            }

            const userId = authData.user.id;

            // 2. Busca Perfil Local (public.profiles)
            let profile = await this.repository.findById(userId);

            // 3. AUTO-HEALING: Cria perfil local se não existir (falha de trigger)
            if (!profile) {
                logger.warn(`[AuthService:Healing] Criando perfil para ${userId}`);
                
                const fallbackUsername = authData.user.user_metadata?.username || `otaku_${userId.substring(0, 5)}`;
                const fallbackFullName = authData.user.user_metadata?.full_name || 'Membro Otaku';
                const determinedRole = (email === 'admin@otakuclashangola.com') ? 'ADMIN' : 'USER';

                profile = await this.repository.createProfileSafely({
                    id: userId,
                    username: fallbackUsername,
                    full_name: fallbackFullName,
                    role: determinedRole
                });
            }

            // 4. VERIFICAÇÃO E ELEVAÇÃO DE PRIVILÉGIO ADMINISTRATIVO MESTRE
            if (email === 'admin@otakuclashangola.com' && profile.role !== 'ADMIN') {
                logger.info(`[AuthService] Elevando privilégios para Admin Mestre: ${email}`);
                profile = await this.repository.update(userId, { role: 'ADMIN' });
            }

            // 5. Geração de Tokens JWT Locais com as claims esperadas
            const accessToken = TokenHelper.generateAccessToken({
                id: profile.id,
                role: profile.role,
                email: authData.user.email,
                username: profile.username
            });

            const refreshToken = TokenHelper.generateRefreshToken(profile.id);

            logger.info(`[AuthService:Success] ${profile.username} logado como ${profile.role}`);

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
            // Se já for um AppError (401/403), apenas repassa
            if (error instanceof AppError) throw error;

            // Erro fatal ou inesperado interno (500)
            logger.error(`[AuthService:Fatal] Erro interno: ${error.message}`, { stack: error.stack });
            throw AppError.internal('Falha ao processar login. Tente novamente mais tarde.');
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

            // 2. Registro no Supabase Auth
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

            // 3. Envio de e-mail de boas-vindas em background (sem travar a resposta)
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
            
            // 2. Busca o perfil atualizado para carregar as permissões e a role corretas
            const profile = await this.repository.findById(decoded.sub);
            
            if (!profile) {
                throw AppError.unauthorized('Sessão inválida. Usuário não encontrado.');
            }

            // 3. Gera novo access token com claims atualizadas do banco de dados
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
