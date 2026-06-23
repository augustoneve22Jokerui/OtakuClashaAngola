/**
 * 🔑 OTAKU CLASH ANGOLA - JWT TOKEN HELPER
 * Versão: 2.0.0 - Enterprise Standard
 * Descrição: Utilitário para geração, decodificação e validação de tokens JWT.
 */

const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');
const AppError = require('../core/errors/AppError');
const logger = require('../config/logger');

class TokenHelper {
  /**
   * 🎟️ GERA ACCESS TOKEN (Curta duração)
   * Contém as permissões (role) e dados de identificação do usuário.
   * @param {Object} user - Dados do usuário { id, role, email, username }
   * @returns {string} Token assinado
   */
  static generateAccessToken(user) {
    try {
      const payload = {
        sub: user.id,       // ID principal do usuário (Subject)
        id: user.id,        // Alias para compatibilidade legada
        role: user.role,    // Necessário para o role.middleware.js
        email: user.email,
        username: user.username,
        type: 'access'
      };

      return jwt.sign(payload, jwtConfig.access.secret, {
        expiresIn: jwtConfig.access.expiresIn,
        algorithm: jwtConfig.access.algorithm
      });
    } catch (error) {
      logger.error(`[TokenHelper:GenerateAccess] Erro: ${error.message}`);
      throw new Error('Falha ao gerar credencial de acesso.');
    }
  }

  /**
   * 🔄 GERA REFRESH TOKEN (Longa duração)
   * Utilizado apenas para renovar a sessão sem exigir nova senha.
   * @param {string} userId - UUID do usuário
   * @returns {string} Token assinado
   */
  static generateRefreshToken(userId) {
    try {
      const payload = {
        sub: userId,
        type: 'refresh'
      };

      return jwt.sign(payload, jwtConfig.refresh.secret, {
        expiresIn: jwtConfig.refresh.expiresIn,
        algorithm: jwtConfig.refresh.algorithm
      });
    } catch (error) {
      logger.error(`[TokenHelper:GenerateRefresh] Erro: ${error.message}`);
      throw new Error('Falha ao gerar credencial de renovação.');
    }
  }

  /**
   * ✅ VALIDA ACCESS TOKEN
   * Verifica assinatura, expiração e integridade.
   * @param {string} token 
   * @returns {Object} Payload decodificado
   */
  static verifyAccessToken(token) {
    try {
      if (!token) throw new AppError('Token de acesso não fornecido.', 401);

      const decoded = jwt.verify(token, jwtConfig.access.secret);

      // Proteção extra contra uso de Refresh Token em rotas de API
      if (decoded.type !== 'access') {
        throw new AppError('Este token não é válido para esta operação.', 401);
      }

      return decoded;
    } catch (error) {
      if (error instanceof AppError) throw error;

      if (error.name === 'TokenExpiredError') {
        throw new AppError('Sua sessão expirou. Por favor, autentique-se novamente.', 401);
      }

      if (error.name === 'JsonWebTokenError') {
        throw new AppError('Token de autenticação inválido ou corrompido.', 401);
      }

      logger.warn(`[TokenHelper:VerifyAccess] Falha na validação: ${error.message}`);
      throw new AppError('Falha ao verificar autenticação.', 401);
    }
  }

  /**
   * 🔄 VALIDA REFRESH TOKEN
   * @param {string} token 
   * @returns {Object} Payload decodificado
   */
  static verifyRefreshToken(token) {
    try {
      if (!token) throw new AppError('Refresh Token é obrigatório.', 401);

      const decoded = jwt.verify(token, jwtConfig.refresh.secret);

      if (decoded.type !== 'refresh') {
        throw new AppError('Tipo de token inválido para renovação.', 401);
      }

      return decoded;
    } catch (error) {
      if (error instanceof AppError) throw error;
      
      logger.warn(`[TokenHelper:VerifyRefresh] Falha na renovação: ${error.message}`);
      throw new AppError('Sessão expirada. Faça login novamente.', 401);
    }
  }

  /**
   * 🔍 DECODE TOKEN (Sem validação)
   * Útil para logs ou leitura rápida de metadados.
   * @param {string} token 
   */
  static decode(token) {
    return jwt.decode(token);
  }
}

module.exports = TokenHelper;