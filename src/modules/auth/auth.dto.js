/**
 * AuthDTO - Responsável por transformar e formatar dados de autenticação e sessão.
 */
class AuthDTO {
  /**
   * Formata a resposta completa de autenticação (Login/Registro).
   * @param {Object} user - Dados do perfil do usuário.
   * @param {Object} tokens - Objeto contendo accessToken e refreshToken.
   */
  static transformAuthResponse(user, tokens) {
    if (!user || !tokens) return null;

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        profile: {
          fullName: user.full_name || null,
          avatarUrl: user.avatar_url || null,
          xp: parseInt(user.xp || 0),
          level: parseInt(user.level || 1),
          isOnline: !!user.is_online,
          lastSeen: user.last_seen
        }
      },
      session: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenType: 'Bearer',
        expiresIn: '1d' // Baseado na config do JWT
      }
    };
  }

  /**
   * Formata apenas os dados do usuário autenticado (Check Me).
   * @param {Object} profile - Dados brutos da tabela public.profiles.
   */
  static transformMe(profile) {
    if (!profile) return null;

    return {
      id: profile.id,
      username: profile.username,
      role: profile.role,
      fullName: profile.full_name,
      avatarUrl: profile.avatar_url,
      xp: parseInt(profile.xp),
      level: parseInt(profile.level),
      createdAt: profile.created_at
    };
  }

  /**
   * Formata a resposta de renovação de token.
   * @param {string} accessToken 
   */
  static transformRefreshResponse(accessToken) {
    return {
      accessToken,
      tokenType: 'Bearer'
    };
  }
}

module.exports = AuthDTO;