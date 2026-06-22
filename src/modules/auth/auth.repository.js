const BaseRepository = require('../../core/base/BaseRepository');
const { supabaseAdmin } = require('../../config/supabase');
const logger = require('../../config/logger');

/**
 * AuthRepository - Gerencia a persistência e interações com o sistema de autenticação.
 */
class AuthRepository extends BaseRepository {
  constructor() {
    super('public.profiles');
  }

  /**
   * Busca um usuário pelo e-mail através da tabela de profiles vinculada.
   * @param {string} email 
   */
  async findByEmail(email) {
    const query = `
      SELECT p.*, au.email 
      FROM public.profiles p
      JOIN auth.users au ON p.id = au.id
      WHERE au.email = $1
      LIMIT 1
    `;
    const { rows } = await this.db.query(query, [email.toLowerCase()]);
    return rows[0] || null;
  }

  /**
   * Busca um usuário pelo nome de usuário.
   * @param {string} username 
   */
  async findByUsername(username) {
    const query = `SELECT * FROM ${this.tableName} WHERE username = $1 LIMIT 1`;
    const { rows } = await this.db.query(query, [username]);
    return rows[0] || null;
  }

  /**
   * Cria um usuário no Supabase Auth Admin.
   * Isso ignora confirmação de e-mail se configurado, útil para registro rápido.
   * @param {Object} userData - { email, password, username, full_name }
   */
  async createSupabaseUser(userData) {
    try {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        user_metadata: {
          username: userData.username,
          full_name: userData.full_name
        },
        email_confirm: true // Registra como já confirmado
      });

      if (error) throw error;
      return data.user;
    } catch (error) {
      logger.error(`[AuthRepository] Erro ao criar usuário no Supabase Auth: ${error.message}`);
      throw error;
    }
  }

  /**
   * Autentica usuário via Supabase Auth.
   */
  async signInWithEmail(email, password) {
    try {
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error(`[AuthRepository] Eró de login: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gera link de recuperação de senha.
   * @param {string} email 
   */
  async generatePasswordResetLink(email) {
    try {
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email
      });

      if (error) throw error;
      return data.properties.action_link;
    } catch (error) {
      logger.error(`[AuthRepository] Erro ao gerar link de reset: ${error.message}`);
      throw error;
    }
  }

  /**
   * Atualiza a senha de um usuário diretamente via Admin API.
   */
  async adminUpdatePassword(userId, newPassword) {
    try {
      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword
      });

      if (error) throw error;
      return data.user;
    } catch (error) {
      logger.error(`[AuthRepository] Erro ao atualizar senha: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verifica se o e-mail ou username já estão em uso.
   */
  async checkConflicts(email, username) {
    const query = `
      SELECT 
        (SELECT COUNT(*) FROM auth.users WHERE email = $1) as email_exists,
        (SELECT COUNT(*) FROM public.profiles WHERE username = $2) as username_exists
    `;
    const { rows } = await this.db.query(query, [email.toLowerCase(), username]);
    
    return {
      emailExists: parseInt(rows[0].email_exists) > 0,
      usernameExists: parseInt(rows[0].username_exists) > 0
    };
  }
}

module.exports = new AuthRepository();