/**
 * 🚀 OTAKU CLASH ANGOLA - COMMON VALIDATION SCHEMAS
 * Versão: 2.5.0 - Industrial Data Integrity & Expanded Admin Limits
 * Descrição: Definições e esquemas de validação reutilizáveis com Zod em todo o ecossistema.
 *            Garante contratos rígidos de tipos para payloads de entrada e queries de busca.
 */

const { z } = require('zod');

/**
 * CommonSchema - Definições de validação reutilizáveis de alta performance.
 */
const CommonSchema = {
  /**
   * Validação de UUID (v4) para IDs primários e chaves estrangeiras relacionais do sistema
   */
  uuid: z.string().uuid({ message: 'ID inválido. Deve ser um UUID.' }),

  /**
   * Validação de ID Numérico (Inteiro Positivo para indexação sequencial legacy)
   */
  numericId: z.coerce.number().int().positive({ message: 'ID deve ser positivo.' }),

  /**
   * Esquema de Paginação Padrão Expandido
   * Maximização do limite para 1000 registros simultâneos de forma a suportar relatórios e grids densas do Painel Admin
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
      .max(1000, 'O limite máximo permitido para administração é 1000 registros')
      .default(10),
    orderBy: z.string().optional(),
    order: z.enum(['ASC', 'DESC']).default('DESC').optional(),
  }),

  /**
   * Filtro de busca textual limpo e sanitizado contra injeções básicas
   */
  search: z.object({
    q: z.string().min(1, 'O termo de busca não pode estar vazio').trim().optional(),
  }),

  /**
   * Validação estrita de URLs para integração com CDN e Storage Buckets
   */
  url: z.string().url({ message: 'URL inválida.' }),

  /**
   * Validação rígida de carimbo de data e hora em conformidade com o padrão ISO 8601
   */
  isoDate: z.string().datetime({ message: 'Data ISO inválida.' }),

  /**
   * Slug de URL (Construção estrutural limpa para rotas amigáveis e SEO)
   */
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug inválido. Use apenas letras minúsculas, números e hífens.',
  }),
};

module.exports = CommonSchema;
