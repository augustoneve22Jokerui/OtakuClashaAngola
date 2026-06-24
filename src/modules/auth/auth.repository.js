/**
 * 🗄️ OTAKU CLASH ANGOLA - AUTH REPOSITORY (ULTRA RESILIENT)
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Camada de persistência para identidade e perfis de usuários.
 */

const BaseRepository = require('../../core/base/BaseRepository');
const { supabaseAdmin } = require('../../config/supabase');
const logger = require('../../config/logger');

class AuthRepository extends BaseRepository {
  constructor() {
    super('public.profiles');
  }

  /**
   * 🔑 AUTENTICAÇÃO NO SUPABASE AUTH
   * Realiza o login via e-mail e senha usando o SDK administrativo.
   */
  async signInWithEmail(email, password) {
    try {
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        // Logamos internamente, o Service decide como reportar ao cliente
        logger.warn(`[AuthRepository:Supabase] Falha de login para ${email}: ${error.message}`);
        throw error;
      }

      return data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 🔍 BUSCA PERFIL LOCAL POR ID
   * @param {string} id - UUID do usuário.
   */
  async findById(id) {
    const query = `
      SELECT 
        p.*, 
        au.email, 
        au.last_sign_in_at
      FROM public.profiles p
      JOIN auth.users au ON p.id = au.id
      WHERE p.id = $1 
      LIMIT 1
    `;
    
    try {
      const { rows } = await this.db.query(query, [id]);
      return rows[0] || null;
    } catch (error) {
      logger.error(`[AuthRepository:Database] Erro ao buscar perfil ${id}: ${error.message}`);
      return null;
    }
  }

  /**
   * 🛠️ CRIAÇÃO SEGURA DE PERFIL (UPSERT)
   * Garante que o registro no banco local exista e esteja sincronizado.
   * Utilizado no fluxo de Auto-Healing caso o trigger do Supabase falhe.
   */
  async createProfileSafely(profileData) {
    const { id, username, full_name, role } = profileData;
    
    const query = `
      INSERT INTO public.profiles (
        id, 
        username, 
        full_name, 
        role, 
        xp, 
        level, 
        created_at, 
        updated_at
      )
      VALUES ($1, $2, $3, $4, 0, 1, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        full_name = EXCLUDED.full_name,
        updated_at = NOW()
      RETURNING *;
    `;

    try {
      const { rows } = await this.db.query(query, [
        id, 
        username, 
        full_name, 
        role || 'USER'
      ]);
      
      if (!rows[0]) {
        throw new Error('Falha ao retornar perfil após inserção.');
      }

      // Inicializa a carteira para o novo perfil se necessário
      await this._ensureWalletExists(id);

      return rows[0];
    } catch (error) {
      logger.error(`[AuthRepository:Critical] Erro ao criar perfil de emergência: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🛡️ VERIFICA CONFLITOS DE IDENTIDADE
   * Valida se username já está em uso no banco local.
   */
  async checkConflicts(email, username) {
    try {
      const query = `
        SELECT 
          (SELECT COUNT(*) FROM public.profiles WHERE username = $1) as username_exists
      `;
      const { rows } = await this.db.query(query, [username]);
      
      return {
        usernameExists: parseInt(rows[0].username_exists) > 0
      };
    } catch (error) {
      logger.error(`[AuthRepository:Conflict] Falha na verificação: ${error.message}`);
      return { usernameExists: false };
    }
  }

  /**
   * 💳 GARANTE EXISTÊNCIA DE CARTEIRA (PRIVATE)
   */
  async _ensureWalletExists(userId) {
    const query = `
      INSERT INTO public.wallets (user_id, balance_available, currency)
      VALUES ($1, 0.00, 'AKZ')
      ON CONFLICT (user_id) DO NOTHING;
    `;
    try {
      await this.db.query(query, [userId]);
    } catch (error) {
      logger.error(`[AuthRepository:Wallet] Erro ao garantir carteira: ${error.message}`);
    }
  }

  /**
   * 🔒 ATUALIZAÇÃO ADMINISTRATIVA DE SENHA
   */
  async adminUpdatePassword(userId, newPassword) {
    try {
      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword
      });

      if (error) throw error;
      return data.user;
    } catch (error) {
      logger.error(`[AuthRepository:Admin] Falha ao trocar senha via Admin: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new AuthRepository();