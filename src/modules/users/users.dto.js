/**
 * UsersDTO - Responsável pela transformação e filtragem de dados de usuários e contas.
 */
class UsersDTO {
  /**
   * Transforma os dados simplificados de um usuário para listagens gerais.
   * @param {Object} user - Registro básico da tabela profiles.
   */
  static transform(user) {
    if (!user) return null;

    return {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatar_url || null,
      level: parseInt(user.level || 1),
      xp: parseInt(user.xp || 0),
      role: user.role,
      createdAt: user.created_at
    };
  }

  /**
   * Transforma uma lista de usuários básicos.
   * @param {Array} users 
   */
  static transformMany(users) {
    if (!users || !Array.isArray(users)) return [];
    return users.map(user => this.transform(user));
  }

  /**
   * Transforma os dados completos do usuário para a visão administrativa.
   * Inclui dados da tabela de profiles e do auth.users (Supabase).
   * @param {Object} user - Objeto mesclado vindo do UsersRepository.findFullById.
   */
  static transformFull(user) {
    if (!user) return null;

    return {
      account: {
        id: user.id,
        email: user.email,
        phone: user.phone || null,
        role: user.role,
        isConfirmed: !!user.confirmed_at,
        lastLogin: user.last_sign_in_at,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      },
      profile: {
        username: user.username,
        fullName: user.full_name || null,
        avatarUrl: user.avatar_url || null,
        xp: parseInt(user.xp || 0),
        level: parseInt(user.level || 1),
        isOnline: !!user.is_online,
        lastSeen: user.last_seen
      }
    };
  }

  /**
   * Transforma um único registro para a listagem na tabela administrativa.
   * @param {Object} user 
   */
  static transformAdmin(user) {
    if (!user) return null;

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      level: parseInt(user.level || 1),
      isConfirmed: !!user.confirmed_at,
      createdAt: user.created_at
    };
  }

  /**
   * Transforma uma lista de usuários para a visão administrativa.
   * @param {Array} users 
   */
  static transformManyAdmin(users) {
    if (!users || !Array.isArray(users)) return [];
    return users.map(user => this.transformAdmin(user));
  }
}

module.exports = UsersDTO;