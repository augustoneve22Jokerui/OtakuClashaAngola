/**
 * ❓ OTAKU CLASH ANGOLA - QUESTIONS REPOSITORY
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Gestão de persistência para o banco de questões e opções de resposta.
 */

const BaseRepository = require('../../core/base/BaseRepository');
const logger = require('../../config/logger');

class QuestionsRepository extends BaseRepository {
  constructor() {
    super('public.questions');
  }

  /**
   * 🎲 OBTÉM SET DE QUESTÕES ALEATÓRIAS (GAME ENGINE)
   * Recupera a questão e suas opções agregadas em um único objeto.
   * @param {Object} params - { animeId, difficulty, category, limit }
   */
  async getRandomQuestions({ animeId, difficulty, category, limit = 10 }) {
    let query = `
      SELECT 
        q.id, 
        q.question_text as "text", 
        q.difficulty_level as "difficulty", 
        q.category, 
        q.points, 
        q.time_limit as "timeLimit",
        q.anime_id as "animeId",
        json_agg(
          json_build_object(
            'id', qo.id,
            'text', qo.option_text
          ) ORDER BY RANDOM()
        ) as options
      FROM public.questions q
      JOIN public.question_options qo ON q.id = qo.question_id
      WHERE 1=1
    `;

    const values = [];
    let paramIndex = 1;

    if (animeId) {
      query += ` AND q.anime_id = $${paramIndex++}`;
      values.push(animeId);
    }

    if (difficulty) {
      query += ` AND q.difficulty_level = $${paramIndex++}`;
      values.push(difficulty);
    }

    if (category) {
      query += ` AND q.category = $${paramIndex++}`;
      values.push(category);
    }

    query += ` GROUP BY q.id ORDER BY RANDOM() LIMIT $${paramIndex}`;
    values.push(limit);

    try {
      const { rows } = await this.db.query(query, values);
      return rows;
    } catch (error) {
      logger.error(`[QuestionsRepo:getRandom] Erro: ${error.message}`);
      return [];
    }
  }

  /**
   * 📋 LISTAGEM ADMINISTRATIVA (DETALHADA)
   * Traz nomes de animes e personagens para facilitar a curadoria.
   */
  async findDetailed({ search, animeId, limit = 20, offset = 0 }) {
    let query = `
      SELECT 
        q.*, 
        a.title as "animeTitle", 
        c.name as "characterName"
      FROM public.questions q
      LEFT JOIN public.animes a ON q.anime_id = a.id
      LEFT JOIN public.characters c ON q.character_id = c.id
      WHERE 1=1
    `;

    const values = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND q.question_text ILIKE $${paramIndex++}`;
      values.push(`%${search}%`);
    }

    if (animeId) {
      query += ` AND q.anime_id = $${paramIndex++}`;
      values.push(animeId);
    }

    query += ` ORDER BY q.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    values.push(limit, offset);

    try {
      const { rows } = await this.db.query(query, values);
      return rows;
    } catch (error) {
      logger.error(`[QuestionsRepo:findDetailed] Erro: ${error.message}`);
      return [];
    }
  }

  /**
   * ✅ BUSCA OPÇÃO CORRETA (VALIDAÇÃO SERVER-SIDE)
   * @param {string} questionId 
   */
  async getCorrectOption(questionId) {
    const query = `
      SELECT id, option_text as "text" 
      FROM public.question_options 
      WHERE question_id = $1 AND is_correct = true 
      LIMIT 1
    `;
    try {
      const { rows } = await this.db.query(query, [questionId]);
      return rows[0] || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * ➕ CRIA OPÇÕES EM LOTE (TRANSACTIONAL)
   * @param {string} questionId 
   * @param {Array} options - [{ text, isCorrect }]
   * @param {Object} client - Cliente de transação
   */
  async createOptions(questionId, options, client) {
    const query = `
      INSERT INTO public.question_options (question_id, option_text, is_correct)
      VALUES ($1, $2, $3)
    `;

    try {
      for (const opt of options) {
        await client.query(query, [questionId, opt.text, opt.isCorrect]);
      }
      return true;
    } catch (error) {
      logger.error(`[QuestionsRepo:createOptions] Erro: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🗑️ REMOVE TODAS AS OPÇÕES DE UMA QUESTÃO
   */
  async deleteOptions(questionId, client = null) {
    const executor = client || this.db;
    const query = `DELETE FROM public.question_options WHERE question_id = $1`;
    try {
      await executor.query(query, [questionId]);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 🆔 BUSCA QUESTÃO COM TODAS AS OPÇÕES (ADMIN VIEW)
   */
  async findByIdWithCorrect(questionId) {
    const query = `
      SELECT 
        q.*,
        (
          SELECT json_agg(json_build_object(
            'id', qo.id,
            'text', qo.option_text,
            'isCorrect', qo.is_correct
          )) FROM public.question_options qo WHERE qo.question_id = q.id
        ) as options
      FROM public.questions q
      WHERE q.id = $1
    `;
    try {
      const { rows } = await this.db.query(query, [questionId]);
      return rows[0] || null;
    } catch (error) {
      return null;
    }
  }
}

module.exports = new QuestionsRepository();