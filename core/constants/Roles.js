/**
 * Roles - Definição dos níveis de autorização do sistema.
 * Implementa o padrão RBAC (Role-Based Access Control).
 */
const Roles = {
  // Superusuário com controle total da infraestrutura e finanças
  ADMIN: 'ADMIN',

  // Responsável pela curadoria de quiz, moderação de chat e suporte
  MODERADOR: 'MODERATOR',

  // Jogador padrão com acesso às funcionalidades competitivas
  USUARIO: 'USER',

  // Conta limitada ou em processo de verificação (opcional)
  GUEST: 'GUEST'
};

/**
 * Lista de roles para validação em esquemas (Zod/Middlewares)
 */
const ALL_ROLES = Object.values(Roles);

/**
 * Hierarquia de permissões (opcional para lógicas de herança)
 */
const ROLES_HIERARCHY = {
  [Roles.ADMIN]: [Roles.ADMIN, Roles.MODERADOR, Roles.USUARIO],
  [Roles.MODERADOR]: [Roles.MODERADOR, Roles.USUARIO],
  [Roles.USUARIO]: [Roles.USUARIO],
};

module.exports = {
  Roles: Object.freeze(Roles),
  ALL_ROLES,
  ROLES_HIERARCHY
};