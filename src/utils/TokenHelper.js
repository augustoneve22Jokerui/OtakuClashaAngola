const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');
const AppError = require('../core/errors/AppError');
const logger = require('../config/logger');

/**
 * TokenHelper - Utilitário para geração e validação de tokens JWT.
 */
class TokenHelper {
  /**
   * Gera um Access Token para autenticação de rotas.
   * @param {Object} user - Objeto do usuário (id, role, email, username)
   * @returns {string} Token JWT assinado
   */
  static generateAccessToken(user) {
    const payload = {
      sub: user.id,
      role: user.role,
      email: user.email,
      username: user.username,
      type: 'access'
    };

    return jwt.sign(payload, jwtConfig.access.secret, {
      expiresIn: jwtConfig.access.expiresIn,
      algorithm: jwtConfig.access.algorithm
    });
  }

  /**
   * Gera um Refresh Token para renovação de sessão.
   * @param {string} userId - UUID do usuário
   * @returns {string} Token JWT assinado
   */
  static generateRefreshToken(userId) {
    const payload = {
      sub: userId,
      type: 'refresh'
    };

    return jwt.sign(payload, jwtConfig.refresh.secret, {
      expiresIn: jwtConfig.refresh.expiresIn,
      algorithm: jwtConfig.refresh.algorithm
    });
  }

  /**
   * Valida um Access Token.
   * @param {string} token 
   * @returns {Object} Payload decodificado
   */
  static verifyAccessToken(token) {
    try {
      return jwt.verify(token, jwtConfig.access.secret);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new AppError('Access Token expirado.', 401);
      }
      throw new AppError('Access Token inválido.', 401);
    }
  }

  /**
   * Valida um Refresh Token.
   * @param {string} token 
   * @returns {Object} Payload decodificado
   */
  static verifyRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, jwtConfig.refresh.secret);
      
      if (decoded.type !== 'refresh') {
        throw new AppError('Tipo de token inválido.', 401);
      }
      
      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new AppError('Refresh Token expirado.', 401);
      }
      throw new AppError('Refresh Token inválido.', 401);
    }
  }

  /**
   * Decodifica um token sem validar a assinatura (uso informativo).
   * @param {string} token 
   */
  static decodeToken(token) {
    return jwt.decode(token);
  }
}

module.exports = TokenHelper;