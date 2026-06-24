/**
 * 🔐 OTAKU CLASH ANGOLA - AUTH REPOSITORY (ULTRA RESILIENT)
 * Versão: 2.6.0 - Robust Destructuring Guards & Enterprise "Full-Full" Edition
 * Descrição: Camada de persistência para identidade, integração Supabase e perfis locais com proteção anti-crash.
 */

const BaseRepository = require('../../core/base/BaseRepository');
const { supabaseAdmin } = require('../../config/supabase');
const logger = require('../../config/logger');

class AuthRepository extends BaseRepository {
  constructor() {
    // Aponta para a tabela pública de perfis
    super('public.profiles');
  }

  /**
   * 🎟️ AUTENTICAÇÃO DIRETA NO SUPABASE AUTH
   * Realiza o desafio de credenciais no provedor externo.
   */
  async signInWithEmail(email, password) {
    try {
      logger.debug(`[AuthRepo:Supabase] Tentando autenticação: ${email}`);
      
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        // Log detalhado para o administrador (não exposto ao cliente)
        logger.warn(`[AuthRepo:Supabase] 401 - Falha para ${email}: ${error.message}`);
        throw error; // Repassa o erro (401/400) para o Service
      }

      return data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 🔍 BUSCA PERFIL LOCAL COM JOIN DE AUTENTICAÇÃO
   * Garante a recuperação de dados do PostgreSQL e do Auth do Supabase em um só passo.
   * Protegido contra quebras de desestruturação caso o banco retorne estruturas inesperadas.
   */
  async findById(id) {
    const query = `
      SELECT 
        p.*, 
        au.email, 
        au.last_sign_in_at as "lastSignIn",
        au.raw_user_meta_data as "authMetadata"
      FROM public.profiles p
      JOIN auth.users au ON p.id = au.id
      WHERE p.id = $1 
      LIMIT 1
    `;
    
    try {
      const result = await this.db.query(query, [id]);
      
      // 🛡️ Destructuring Shield: Validação profunda antes de acessar propriedades de retorno
      if (!result || !result.rows || result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      logger.error(`[AuthRepo:findById] Erro: ${error.message}`);
      // Retornamos null para que o AuthService possa acionar o Auto-Healing com segurança
      return null;
    }
  }

  /**
   * 🛠️ CRIAÇÃO RESILIENTE DE PERFIL (AUTO-HEALING)
   * Garante que o registo no banco local exista, mesmo que o Trigger do Supabase falhe.
   */
  async createProfileSafely(profileData) {
    const { id, username, full_name, role } = profileData;
    
    // UPSERT: Se já existir, apenas atualiza. Se não, insere os estados iniciais.
    const query = `
      INSERT INTO public.profiles (
        id, 
        username, 
        full_name, 
        role, 
        xp, 
        level, 
        is_online,
        created_at, 
        updated_at
      )
      VALUES ($1, $2, $3, $4, 0, 1, false, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        username = COALESCE(EXCLUDED.username, public.profiles.username),
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        updated_at = NOW()
      RETURNING *;
    `;

    try {
      const result = await this.db.query(query, [
        id, 
        username, 
        full_name, 
        role || 'USER'
      ]);

      // 🛡️ Destructuring Shield aplicado à resposta do banco de dados
      if (result && result.rows && result.rows.length > 0) {
        // Garante que a carteira financeira também exista para o utilizador
        await this._ensureWallet(id);
        return result.rows[0];
      }
      
      throw new Error('Retorno vazio na criação de perfil.');
    } catch (error) {
      logger.error(`[AuthRepo:createProfileSafely] Falha: ${error.message}`);
      throw error;
    }
  }

  /**
   * 💳 GARANTE CARTEIRA ATIVA (INTERNAL)
   */
  async _ensureWallet(userId) {
    const query = `
      INSERT INTO public.wallets (user_id, balance_available, currency, updated_at)
      VALUES ($1, 0.00, 'AKZ', NOW())
      ON CONFLICT (user_id) DO NOTHING;
    `;
    try {
      await this.db.query(query, [userId]);
    } catch (e) {
      logger.warn(`[AuthRepo:Wallet] ${e.message}`);
    }
  }

  /**
   * 🛡️ VERIFICA CONFLITOS DE USERNAME
   */
  async checkConflicts(username) {
    const query = `SELECT 1 FROM public.profiles WHERE username = $1 LIMIT 1`;
    try {
      const result = await this.db.query(query, [username]);
      
      // 🛡️ Destructuring Shield contra retorno malformado do driver
      const exists = !!(result && result.rows && result.rows.length > 0);
      return { usernameExists: exists };
    } catch (error) {
      logger.error(`[AuthRepo:checkConflicts] Erro na verificação de username: ${error.message}`);
      return { usernameExists: false };
    }
  }

  /**
   * 🔑 ATUALIZA SENHA (ADMIN BYPASS)
   */
  async adminUpdatePassword(userId, newPassword) {
    try {
      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword
      });

      if (error) throw error;
      return data.user;
    } catch (error) {
      logger.error(`[AuthRepo:Admin] Erro ao redefinir senha: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new AuthRepository();
