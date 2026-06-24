/**
 * 🕵️ OTAKU CLASH ANGOLA - AUTHENTICATION MIDDLEWARE
 * Versão: 2.1.0 - Robust UUID Check & Enterprise Resilient
 * Descrição: Interceptador de segurança para validação de tokens JWT em rotas protegidas.
 */

const TokenHelper = require('../utils/TokenHelper');
const AppError = require('../core/errors/AppError');
const logger = require('../config/logger');

/**
 * Middleware para validar a sessão do usuário via Bearer Token.
 */
const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // 1. Verifica presença do cabeçalho
    if (!authHeader) {
      return next(AppError.unauthorized('Token de autenticação não fornecido.'));
    }

    // 2. Extração e validação do formato Bearer
    // Suporta tanto "Bearer <token>" quanto "bearer <token>"
    const parts = authHeader.split(' ');

    if (parts.length !== 2) {
      return next(AppError.unauthorized('Erro no formato da credencial de acesso.'));
    }

    const [scheme, token] = parts;

    if (!/^Bearer$/i.test(scheme)) {
      return next(AppError.unauthorized('Token malformado ou esquema inválido.'));
    }

    /**
     * 3. Verificação do Token
     * Utiliza o TokenHelper centralizado para garantir consistência na 
     * validação da assinatura e expiração.
     */
    const decoded = TokenHelper.verifyAccessToken(token);

    // Validação robusta de UUID/Identificador ausente no payload decodificado
    if (!decoded || (!decoded.sub && !decoded.id)) {
      return next(AppError.unauthorized('Token inválido: Identificador ausente.'));
    }

    /**
     * 4. Injeção dos dados do usuário na Requisição
     * Padronização absoluta: ID sempre em req.user.id vindo do 'sub' ou 'id' do JWT.
     * req.user.role é fundamental em caixa alta para o funcionamento correto do roleMiddleware.
     */
    req.user = {
      id: decoded.sub || decoded.id,
      role: (decoded.role || 'USER').toUpperCase(),
      email: decoded.email,
      username: decoded.username
    };

    // 5. Continua para a próxima função ou middleware
    return next();

  } catch (error) {
    /**
     * Tratamento de Erros granulares
     * Se o TokenHelper lançar um AppError, o middleware o repassa ao Handler Global.
     */
    if (error instanceof AppError) {
      return next(error);
    }

    // Captura específica para expiração de token JWT padrão
    if (error.name === 'TokenExpiredError') {
      return next(AppError.unauthorized('Sua sessão expirou.'));
    }

    // Erros inesperados no processamento do middleware
    logger.error(`[AuthMiddleware:Fatal] ${error.message}`);
    return next(AppError.unauthorized('Credencial de acesso inválida.'));
  }
};

module.exports = authMiddleware;
