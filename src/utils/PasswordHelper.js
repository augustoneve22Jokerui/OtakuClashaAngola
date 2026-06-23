const bcrypt = require('bcryptjs');
const logger = require('../config/logger');

/**
 * PasswordHelper - Utilitário para criptografia e verificação de senhas.
 */
class PasswordHelper {
  /**
   * Gera um hash seguro a partir de uma senha em texto plano.
   * @param {string} password - A senha digitada pelo usuário.
   * @returns {Promise<string>} O hash gerado.
   */
  static async hash(password) {
    try {
      const saltRounds = 12;
      const salt = await bcrypt.genSalt(saltRounds);
      return await bcrypt.hash(password, salt);
    } catch (error) {
      logger.error(`[PasswordHelper] Erro ao gerar hash: ${error.message}`);
      throw new Error('Falha ao processar segurança da senha.');
    }
  }

  /**
   * Compara uma senha em texto plano com um hash armazenado.
   * @param {string} password - Senha enviada na tentativa de login.
   * @param {string} hash - Hash recuperado do banco de dados.
   * @returns {Promise<boolean>} Verdadeiro se as senhas coincidirem.
   */
  static async compare(password, hash) {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      logger.error(`[PasswordHelper] Erro ao comparar senhas: ${error.message}`);
      return false;
    }
  }

  /**
   * Valida se a senha atende aos requisitos mínimos de complexidade.
   * (Útil como validação secundária além do Zod).
   * @param {string} password 
   * @returns {boolean}
   */
  static isStrong(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasNonalphas = /\W/.test(password);
    
    return (
      password.length >= minLength &&
      hasUpperCase &&
      hasLowerCase &&
      hasNumbers &&
      hasNonalphas
    );
  }
}

module.exports = PasswordHelper;