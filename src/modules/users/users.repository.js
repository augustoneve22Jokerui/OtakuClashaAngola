/**
 * 👥 OTAKU CLASH ANGOLA - USERS REPOSITORY (ADMIN VIEW)
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Gestão de persistência para administração de contas de utilizadores.
 */

const BaseRepository = require('../../core/base/BaseRepository');
const logger = require('../../config/logger');

class UsersRepository extends BaseRepository {
  constructor() {
    // Opera sobre a tabela pública de perfis
    super('public.profiles');
  }

  /**
   * 🔍 BUSCA AVANÇADA DE UTILIZADORES (ADMIN)
   * Realiza Join com o schema de autenticação do Supabase para obter dados sensíveis.
   * @param {Object} params - { search, role, status, limit, offset }
   */
  async findWithFilters({ search, role, status, limit = 10, offset = 0 }) {
    let query = `
      SELECT 
        p.id, 
        p.username, 
        p.full_name, 
        p.avatar_url, 
        p.role, 
        p.xp, 
        p.level, 
        p.is_online, 
        p.last_seen, 
        p.created_at,
        au.email, 
        au.last_sign_in_at as "lastLogin",
        au.confirmed_at IS NOT NULL as "isConfirmed",
        (au.raw_user_meta_data->>'suspended')::boolean as "isSuspended"
      FROM public.profiles p
      JOIN auth.users au ON p.id = au.id
      WHERE 1=1
    `;

    const values = [];
    let paramIndex = 1;

    // Filtro por Nome ou Email
    if (search) {
      query += ` AND (p.username ILIKE $${paramIndex} OR au.email ILIKE $${paramIndex} OR p.full_name ILIKE $${paramIndex})`;
      values.push(`%${search}%`);
      paramIndex++;
    }

    // Filtro por Cargo (Role)
    if (role) {
      query += ` AND p.role = $${paramIndex}`;
      values.push(role);
      paramIndex++;
    }

    // Filtro por Status (Online/Offline)
    if (status === 'online') {
      query += ` AND p.is_online = true`;
    } else if (status === 'offline') {
      query += ` AND p.is_online = false`;
    }

    query += ` ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    values.push(limit, offset);

    try {
      const { rows } = await this.db.query(query, values);
      return rows;
    } catch (error) {
      logger.error(`[UsersRepository:findWithFilters] Erro: ${error.message}`);
      return [];
    }
  }

  /**
   * 🆔 BUSCA DETALHADA POR ID (ADMIN)
   */
  async findFullById(userId) {
    const query = `
      SELECT 
        p.*, 
        au.email, 
        au.phone, 
        au.last_sign_in_at, 
        au.confirmed_at,
        au.raw_user_meta_data as "metaData"
      FROM public.profiles p
      JOIN auth.users au ON p.id = au.id
      WHERE p.id = $1
      LIMIT 1
    `;

    try {
      const { rows } = await this.db.query(query, [userId]);
      return rows[0] || null;
    } catch (error) {
      logger.error(`[UsersRepository:findFullById] Erro: ${error.message}`);
      return null;
    }
  }

  /**
   * 📈 CONTAGEM FILTRADA (PARA PAGINAÇÃO)
   */
  async countWithFilters({ search, role }) {
    let query = `
      SELECT COUNT(*) as total 
      FROM public.profiles p
      JOIN auth.users au ON p.id = au.id
      WHERE 1=1
    `;
    
    const values = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (p.username ILIKE $${paramIndex} OR au.email ILIKE $${paramIndex})`;
      values.push(`%${search}%`);
      paramIndex++;
    }

    if (role) {
      query += ` AND p.role = $${paramIndex}`;
      values.push(role);
    }

    try {
      const { rows } = await this.db.query(query, values);
      return parseInt(rows[0].total, 10);
    } catch (error) {
      logger.error(`[UsersRepository:count] Erro: ${error.message}`);
      return 0;
    }
  }

  /**
   * 🔨 ATUALIZAÇÃO DE METADADOS DE CONTA (SUSPENSÃO)
   * Nota: A suspensão real é persistida no metadado do Supabase Auth 
   * para que o serviço de autenticação possa barrar o login.
   */
  async updateAccountMetadata(userId, metadata) {
    // Atualização no banco local para histórico/visibilidade
    const query = `
      UPDATE public.audit_logs 
      SET new_values = new_values || $1::jsonb 
      WHERE resource_id = $2 
      AND resource_type = 'USER'
      ORDER BY created_at DESC LIMIT 1
    `;
    
    try {
      // Chamada via Supabase Admin para atualizar o auth.users
      const { data, error } = await this.supabase.auth.admin.updateUserById(userId, {
        user_metadata: metadata
      });

      if (error) throw error;
      return data.user;
    } catch (error) {
      logger.error(`[UsersRepository:Metadata] Erro ao atualizar Auth: ${error.message}`);
      throw error;
    }
  }

  /**
   * 📊 OBTÉM USUÁRIOS RECENTES
   */
  async findRecent(limit = 5) {
    const query = `
      SELECT id, username, avatar_url, role, created_at 
      FROM public.profiles 
      ORDER BY created_at DESC 
      LIMIT $1
    `;
    try {
      const { rows } = await this.db.query(query, [limit]);
      return rows;
    } catch (error) {
      return [];
    }
  }
}

module.exports = new UsersRepository();