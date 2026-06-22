const { z } = require('zod');
const { MatchTypes } = require('../core/constants/MatchTypes');

/**
 * QuizSchema - Esquemas de validação para sessões de quiz, duelos e respostas.
 */
const QuizSchema = {
  /**
   * Validação para iniciar uma nova sessão de quiz
   */
  start: z.object({
    anime_id: z.coerce.number().int().positive().optional(),
    mode: z.enum([
      MatchTypes.QUICK_PLAY,
      MatchTypes.SURVIVAL,
      MatchTypes.PRACTICE,
      MatchTypes.BLITZ
    ]).default(MatchTypes.QUICK_PLAY),
    difficulty: z.coerce.number().int().min(1).max(5).default(1),
  }),

  /**
   * Validação para submissão de resposta
   */
  submitAnswer: z.object({
    session_id: z.string().uuid('ID de sessão inválido'),
    question_id: z.string().uuid('ID de questão inválido'),
    option_id: z.string().uuid('ID de opção inválido'),
    response_time_ms: z.number().int().min(0, 'Tempo de resposta inválido'),
  }),

  /**
   * Validação para criação de sala de duelo (1v1)
   */
  createDuel: z.object({
    entry_fee: z.coerce
      .number()
      .min(0, 'O valor de entrada não pode ser negativo')
      .max(1000000, 'Valor de aposta excedeu o limite permitido'),
    is_private: z.boolean().default(false),
    anime_id: z.coerce.number().int().positive().optional(),
  }),

  /**
   * Validação para entrada em sala via código
   */
  joinRoom: z.object({
    room_code: z
      .string()
      .length(6, 'O código da sala deve ter exatamente 6 caracteres')
      .toUpperCase(),
  }),

  /**
   * Validação para o modo Battle Royale
   */
  battleRoyaleJoin: z.object({
    room_id: z.string().uuid('ID da sala de Battle Royale inválido'),
  }),

  /**
   * Validação de filtros para listagem de sessões/histórico
   */
  historyFilters: z.object({
    status: z.enum(['FINISHED', 'ABANDONED', 'IN_PROGRESS']).optional(),
    anime_id: z.coerce.number().int().optional(),
  }),
};

module.exports = QuizSchema;