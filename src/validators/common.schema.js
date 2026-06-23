const { z } = require('zod');

/**
 * CommonSchema - Definições de validação reutilizáveis.
 */
const CommonSchema = {
  /**
   * Validação de UUID (v4) para IDs do sistema
   */
  uuid: z.string().uuid({ message: 'ID inválido. Deve ser um UUID válido.' }),

  /**
   * Validação de ID Numérico (Inteiro Positivo)
   */
  numericId: z.coerce.number().int().positive({ message: 'ID deve ser um número inteiro positivo.' }),

  /**
   * Esquema de Paginação Padrão
   */
  pagination: z.object({
    page: z.coerce
      .number()
      .int()
      .min(1, 'A página mínima é 1')
      .default(1),
    limit: z.coerce
      .number()
      .int()
      .min(1, 'O limite mínimo é 1')
      .max(100, 'O limite máximo permitido é 100')
      .default(10),
    orderBy: z.string().optional(),
    order: z.enum(['ASC', 'DESC']).default('DESC').optional(),
  }),

  /**
   * Filtro de busca textual simples
   */
  search: z.object({
    q: z.string().min(1, 'O termo de busca não pode estar vazio').trim().optional(),
  }),

  /**
   * Validação de URL
   */
  url: z.string().url({ message: 'Formato de URL inválido.' }),

  /**
   * Validação de Data ISO
   */
  isoDate: z.string().datetime({ message: 'Data inválida. Use o formato ISO8601.' }),

  /**
   * Slug de URL (Para rotas amigáveis)
   */
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug inválido. Use apenas letras minúsculas, números e hífens.',
  }),
};

module.exports = CommonSchema;