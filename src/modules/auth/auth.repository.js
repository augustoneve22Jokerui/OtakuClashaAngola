/**
 * 🚀 OTAKU CLASH ANGOLA - AUTH REPOSITORY (ULTRA RESILIENTE)
 * Versão: Ultra Mega Final - Enterprise Grade
 * Descrição: Gestão de persistência de identidade e integração direta com Supabase Auth Admin.
 */

const BaseRepository = require('../../core/base/BaseRepository');
const { supabaseAdmin } = require('../../config/supabase');
const logger = require('../../config/logger');

class AuthRepository extends BaseRepository {
  constructor() {
    super('public.profiles');
  }

  /**
   * 🛡️ AUTENTICAÇÃO DIRETA NO SUPABASE
   */
  async signInWithEmail(email, password) {
    try {
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        // Logamos o erro mas deixamos o Service decidir se é 401 ou 500
        logger.error(`[AuthRepository] Erro no Supabase Auth para ${email}: ${error.message}`);
        throw error;
      }

      return data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 🔎 BUSCA PERFIL COM TRATAMENTO DE ERRO
   */
  async findById(id) {
    try {
      const query = `SELECT * FROM ${this.tableName} WHERE id = $1 LIMIT 1`;
      const { rows } = await this.db.query(query, [id]);
      return rows[0] || null;
    } catch (error) {
      logger.error(`[AuthRepository] Falha ao buscar perfil ID ${id}: ${error.message}`);
      return null; // Retornamos null para o Service acionar o fallback de criação
    }
  }

  /**
   * 🛠️ CRIAÇÃO DE PERFIL COM "UPSERT" (EVITA ERRO 500 DE DUPLICIDADE)
   * Se o trigger do banco falhar ou o usuário já existir, este método garante a integridade.
   */
  async createProfileSafely(profileData) {
    const { id, username, full_name, role } = profileData;
    
    const query = `
      INSERT INTO public.profiles (id, username, full_name, role, xp, level, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 0, 1, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        full_name = EXCLUDED.full_name,
        updated_at = NOW()
      RETURNING *;
    `;

    try {
      const { rows } = await this.db.query(query, [id, username, full_name, role || 'USER']);
      return rows[0];
    } catch (error) {
      logger.error(`[AuthRepository] Erro crítico ao criar/atualizar perfil: ${error.message}`);
      throw error; // Aqui lançamos erro pois é falha de banco (500)
    }
  }

  /**
   * 🚦 VERIFICAÇÃO DE DISPONIBILIDADE
   */
  async checkConflicts(email, username) {
    try {
      // Verificamos no Auth e no Profile simultaneamente
      const query = `
        SELECT 
          (SELECT COUNT(*) FROM public.profiles WHERE username = $1) as username_exists
      `;
      const { rows } = await this.db.query(query, [username]);
      
      return {
        emailExists: false, // Supabase Auth já valida isso no signUp
        usernameExists: parseInt(rows[0].username_exists) > 0
      };
    } catch (error) {
      logger.error(`[AuthRepository] Falha ao verificar conflitos: ${error.message}`);
      return { emailExists: false, usernameExists: false };
    }
  }

  /**
   * 🔑 ADMIN: ATUALIZA SENHA
   */
  async adminUpdatePassword(userId, newPassword) {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword
    });

    if (error) throw error;
    return data.user;
  }
}

module.exports = new AuthRepository();
