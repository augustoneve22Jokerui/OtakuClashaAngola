const { z } = require('zod');

/**
 * AuthSchema - Esquemas de validação para fluxos de autenticação e conta.
 */
const AuthSchema = {
  /**
   * Validação para registro de novo usuário
   */
  register: z.object({
    username: z
      .string()
      .min(3, 'O nome de usuário deve ter pelo menos 3 caracteres')
      .max(30, 'O nome de usuário deve ter no máximo 30 caracteres')
      .regex(/^[a-zA-Z0-9_]+$/, 'O nome de usuário pode conter apenas letras, números e underlines')
      .trim(),
    email: z
      .string()
      .email('Formato de e-mail inválido')
      .toLowerCase()
      .trim(),
    password: z
      .string()
      .min(8, 'A senha deve ter pelo menos 8 caracteres')
      .regex(/[A-Z]/, 'A senha deve conter pelo menos uma letra maiúscula')
      .regex(/[a-z]/, 'A senha deve conter pelo menos uma letra minúscula')
      .regex(/[0-9]/, 'A senha deve conter pelo menos um número')
      .regex(/[^A-Za-z0-9]/, 'A senha deve conter pelo menos um caractere especial'),
    full_name: z
      .string()
      .min(2, 'Nome completo deve ter pelo menos 2 caracteres')
      .max(100, 'Nome completo muito longo')
      .optional(),
  }),

  /**
   * Validação para login
   */
  login: z.object({
    email: z
      .string()
      .email('Formato de e-mail inválido')
      .toLowerCase()
      .trim(),
    password: z
      .string()
      .min(1, 'A senha é obrigatória'),
  }),

  /**
   * Validação para renovação de token
   */
  refreshToken: z.object({
    refreshToken: z
      .string()
      .min(1, 'O Refresh Token é obrigatório'),
  }),

  /**
   * Validação para recuperação de senha (solicitação)
   */
  forgotPassword: z.object({
    email: z
      .string()
      .email('Formato de e-mail inválido')
      .toLowerCase()
      .trim(),
  }),

  /**
   * Validação para reset de senha (nova senha)
   */
  resetPassword: z.object({
    token: z.string().min(1, 'Token de recuperação é obrigatório'),
    password: z
      .string()
      .min(8, 'A nova senha deve ter pelo menos 8 caracteres')
      .regex(/[A-Z]/, 'A senha deve conter pelo menos uma letra maiúscula')
      .regex(/[0-9]/, 'A senha deve conter pelo menos um número'),
    confirmPassword: z.string()
  }).refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  }),

  /**
   * Validação para atualização de perfil básico
   */
  updateProfile: z.object({
    username: z
      .string()
      .min(3)
      .max(30)
      .optional(),
    full_name: z
      .string()
      .min(2)
      .max(100)
      .optional(),
    avatar_url: z
      .string()
      .url('URL do avatar inválida')
      .optional(),
  }),
};

module.exports = AuthSchema;