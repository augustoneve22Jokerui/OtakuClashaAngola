/**
 * 🔐 OTAKU CLASH ANGOLA - AUTH SERVICE (ULTRA RESILIENT)
 * Versão: 2.1.3 - Final Supabase Error Parsing & Debugging Precision
 * Descrição: Orquestrador de identidade, sessões e auto-healing de perfis locais.
 */

const BaseService = require('../../core/base/BaseService');
const authRepository = require('./auth.repository');
const TokenHelper = require('../../utils/TokenHelper');
const AppError = require('../../core/errors/AppError');
const logger = require('../../config/logger');
const emailService = require('../../services/notification/EmailService');
const util = require('util'); // Para inspeção profunda de logs no ambiente de produção

class AuthService extends BaseService {
    constructor() {
        super(authRepository);
    }

    /**
     * 🔥 LOGIN COM AUTO-HEALING DE PERFIL
     * Autentica no Supabase com captura altamente precisa de logs e tratamento agressivo de erros.
     */
    async login(email, password) {
        try {
            logger.info(`[AuthService] Tentativa de login para: ${email}`);

            // 1. Autenticação no Supabase Auth externa com captura isolada
            let authData;
            try {
                authData = await this.repository.signInWithEmail(email, password);
            } catch (err) {
                // 🔥 LOG DE EMERGÊNCIA NO CONSOLE (Ideal para monitoramento no Render / VPS)
                console.error("--- SUPABASE AUTH ERROR DEBUG ---");
                console.error(util.inspect(err, { showHidden: false, depth: null, colors: true }));
                
                // Extração agressiva e normalização da mensagem de erro do provedor
                let msg = "Falha na autenticação.";
                if (err.message) {
                    msg = err.message;
                } else if (typeof err === 'string') {
                    msg = err;
                } else if (err.error_description) {
                    msg = err.error_description;
                } else {
                    msg = JSON.stringify(err);
                }

                const statusCode = err.status || 401;

                // Tradução cirúrgica de mensagens técnicas do ecossistema Supabase para o usuário final
                if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
                    msg = 'E-mail ou senha incorrectos.';
                } else if (msg.toLowerCase().includes('confirm')) {
                    msg = 'Por favor, confirme o seu e-mail antes de aceder.';
                } else if (statusCode === 400) {
                    msg = 'Credenciais inválidas. Verifique seu e-mail e senha.';
                }

                logger.warn(`[AuthService:Denied] Usuário: ${email} | Mensagem Final: ${msg}`);
                
                // Lançamos explicitamente como 401 para o ErrorHandler não converter em 500
                throw new AppError(msg, 401);
            }

            if (!authData || !authData.user) {
                throw AppError.unauthorized('Credenciais validadas, mas usuário não retornado pelo provedor.');
            }

            const userId = authData.user.id;

            // 2. Busca Perfil Local (public.profiles)
            let profile = await this.repository.findById(userId);

            // 3. AUTO-HEALING: Se logou no Auth mas não tem profile no DB local (falha de trigger de banco)
            if (!profile) {
                logger.warn(`[AuthService:AutoHealing] Criando perfil ausente para UID: ${userId}`);
                
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

            // 5. Geração de Tokens JWT (Otaku Clash Token) com as claims esperadas
            const accessToken = TokenHelper.generateAccessToken({
                id: profile.id,
                role: profile.role,
                email: authData.user.email,
                username: profile.username
            });

            const refreshToken = TokenHelper.generateRefreshToken(profile.id);

            logger.info(`[AuthService:Success] Login concluído: ${profile.username} [${profile.role}]`);

            // 6. Estrutura de retorno compatível com DTO e Camada de Apresentação
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
            // Repassa erros operacionais mapeados (AppError) sem modificações
            if (error instanceof AppError) throw error;

            // Erros fatais imprevistos (Tratados como 500 Interno)
            logger.error(`[AuthService:Fatal] Erro interno crítico: ${error.message}`, { stack: error.stack });
            throw AppError.internal('Falha crítica no processo de login.');
        }
    }

    /**
     * 📝 REGISTRO DE NOVO USUÁRIO
     */
    async register(userData) {
        try {
            // 1. Verifica conflitos locais antes de acionar a API do Supabase Auth
            const { usernameExists } = await this.repository.checkConflicts(null, userData.username);
            
            if (usernameExists) {
                throw AppError.conflict('Este nome de usuário já está sendo utilizado.');
            }

            // 2. Criação da identidade no provedor Supabase Auth
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

            // 3. Dispara e-mail de boas-vindas assincronamente (Background Task)
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
            logger.error(`[AuthService:Register] Erro no registro: ${error.message}`);
            throw AppError.internal('Não foi possível completar o cadastro neste momento.');
        }
    }

    /**
     * 🔄 RENOVAÇÃO DE SESSÃO (REFRESH TOKEN)
     */
    async refreshSession(refreshToken) {
        try {
            // 1. Descodifica e valida o token de atualização
            const decoded = TokenHelper.verifyRefreshToken(refreshToken);
            
            // 2. Re-avalia o perfil local para sincronizar dados mutáveis (roles/bloqueios)
            const profile = await this.repository.findById(decoded.sub);
            
            if (!profile) {
                throw AppError.unauthorized('Sessão inválida. Usuário não encontrado.');
            }

            // 3. Emite novo access token com as claims atualizadas da persistência relacional
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

// Exportação Singleton da classe totalmente funcional
module.exports = new AuthService();
