const BaseRepository = require('../../core/base/BaseRepository');

/**
 * QuestionsRepository - Camada de acesso a dados para o banco de questões e opções.
 */
class QuestionsRepository extends BaseRepository {
  constructor() {
    super('public.questions');
  }

  /**
   * Busca um conjunto de questões aleatórias com suas opções.
   * @param {Object} params - { animeId, difficulty, limit, category }
   */
  async getRandomQuestions({ animeId, difficulty, limit = 10, category }) {
    let query = `
      SELECT 
        q.*,
        json_agg(
          json_build_object(
            'id', qo.id,
            'text', qo.option_text,
            'is_correct', qo.is_correct
          ) ORDER BY RANDOM()
        ) as options
      FROM ${this.tableName} q
      JOIN public.question_options qo ON q.id = qo.question_id
      WHERE 1=1
    `;
    const values = [];
    let paramCount = 0;

    if (animeId) {
      paramCount++;
      query += ` AND q.anime_id = $${paramCount}`;
      values.push(animeId);
    }

    if (difficulty) {
      paramCount++;
      query += ` AND q.difficulty_level = $${paramCount}`;
      values.push(difficulty);
    }

    if (category) {
      paramCount++;
      query += ` AND q.category = $${paramCount}`;
      values.push(category);
    }

    query += ` GROUP BY q.id ORDER BY RANDOM() LIMIT $${paramCount + 1}`;
    values.push(limit);

    const { rows } = await this.db.query(query, values);
    return rows;
  }

  /**
   * Busca as opções de uma questão específica.
   * @param {string} questionId 
   */
  async getOptionsByQuestionId(questionId) {
    const query = `
      SELECT id, option_text, is_correct 
      FROM public.question_options 
      WHERE question_id = $1
    `;
    const { rows } = await this.db.query(query, [questionId]);
    return rows;
  }

  /**
   * Busca a opção correta de uma questão.
   */
  async getCorrectOption(questionId) {
    const query = `
      SELECT * FROM public.question_options 
      WHERE question_id = $1 AND is_correct = true 
      LIMIT 1
    `;
    const { rows } = await this.db.query(query, [questionId]);
    return rows[0] || null;
  }

  /**
   * Cria as opções de uma questão dentro de uma transação.
   */
  async createOptions(questionId, options, client = null) {
    const executor = client || this.db;
    const queries = options.map(opt => {
      return executor.query(
        'INSERT INTO public.question_options (question_id, option_text, is_correct) VALUES ($1, $2, $3)',
        [questionId, opt.text, opt.isCorrect]
      );
    });
    return await Promise.all(queries);
  }

  /**
   * Lista questões com detalhes do anime/personagem vinculado para o Admin.
   */
  async findDetailed({ limit = 20, offset = 0, animeId = null }) {
    let query = `
      SELECT q.*, a.title as anime_title, c.name as character_name
      FROM ${this.tableName} q
      LEFT JOIN public.animes a ON q.anime_id = a.id
      LEFT JOIN public.characters c ON q.character_id = c.id
      WHERE 1=1
    `;
    const values = [limit, offset];

    if (animeId) {
      query += ` AND q.anime_id = $3`;
      values.push(animeId);
    }

    query += ` ORDER BY q.created_at DESC LIMIT $1 OFFSET $2`;

    const { rows } = await this.db.query(query, values);
    return rows;
  }

  /**
   * Remove todas as opções de uma questão.
   */
  async deleteOptions(questionId, client = null) {
    const executor = client || this.db;
    await executor.query('DELETE FROM public.question_options WHERE question_id = $1', [questionId]);
  }
}

module.exports = new QuestionsRepository();