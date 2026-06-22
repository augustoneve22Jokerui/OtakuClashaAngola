const db = require('../../config/database');
const logger = require('../../config/logger');
const AppError = require('../../core/errors/AppError');

/**
 * QuestionGeneratorService - Automatiza a criação de questões baseadas
 * nos dados sincronizados da Jikan API.
 */
class QuestionGeneratorService {
  /**
   * Gera questões para um anime específico.
   * @param {number} animeId - ID local do anime.
   */
  async generateForAnime(animeId) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // 1. Busca dados do anime e seus personagens
      const animeQuery = `SELECT * FROM public.animes WHERE id = $1`;
      const charQuery = `SELECT * FROM public.characters WHERE anime_id = $1`;
      
      const { rows: [anime] } = await client.query(animeQuery, [animeId]);
      const { rows: characters } = await client.query(charQuery, [animeId]);

      if (!anime || characters.length === 0) {
        throw new Error('Dados insuficientes para gerar questões.');
      }

      // 2. Gerar Questões de Personagem (Quem é este personagem?)
      for (const char of characters) {
        await this.createCharacterQuestion(client, anime, char);
      }

      // 3. Gerar Questões de Conhecimento Geral (Qual o gênero, episódios, etc)
      await this.createGeneralAnimeQuestion(client, anime);

      await client.query('COMMIT');
      logger.info(`[QuestionGenerator] Questões geradas com sucesso para o anime: ${anime.title}`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`[QuestionGenerator] Erro ao gerar questões: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Cria uma questão do tipo: "De qual anime é este personagem?"
   */
  async createCharacterQuestion(client, anime, character) {
    const questionText = `O personagem "${character.name}" pertence a qual destes animes?`;
    
    // Busca 3 animes aleatórios como distratores (opções erradas)
    const distractorQuery = `
      SELECT title FROM public.animes 
      WHERE id != $1 
      ORDER BY RANDOM() 
      LIMIT 3
    `;
    const { rows: distractors } = await client.query(distractorQuery, [anime.id]);

    const questionId = await this.saveQuestion(client, {
      anime_id: anime.id,
      character_id: character.id,
      text: questionText,
      difficulty: character.role === 'Main' ? 1 : 3,
      category: 'CHARACTER',
      points: character.role === 'Main' ? 10 : 25
    });

    // Salva a opção correta
    await this.saveOption(client, questionId, anime.title, true);

    // Salva as opções incorretas
    for (const d of distractors) {
      await this.saveOption(client, questionId, d.title, false);
    }
  }

  /**
   * Cria uma questão sobre metadados do anime.
   */
  async createGeneralAnimeQuestion(client, anime) {
    const questionText = `Qual é o gênero principal do anime "${anime.title}"?`;
    const genres = JSON.parse(anime.genres || '[]');
    
    if (genres.length === 0) return;

    const correctGenre = genres[0];
    
    const distractorQuery = `
      SELECT DISTINCT jsonb_array_elements_text(genres) as genre 
      FROM public.animes 
      WHERE genres->>0 != $1 
      LIMIT 3
    `;
    const { rows: distractors } = await client.query(distractorQuery, [correctGenre]);

    const questionId = await this.saveQuestion(client, {
      anime_id: anime.id,
      text: questionText,
      difficulty: 2,
      category: 'ANIME',
      points: 15
    });

    await this.saveOption(client, questionId, correctGenre, true);
    for (const d of distractors) {
      await this.saveOption(client, questionId, d.genre, false);
    }
  }

  /**
   * Auxiliar para persistir a questão.
   */
  async saveQuestion(client, data) {
    const query = `
      INSERT INTO public.questions (anime_id, character_id, question_text, difficulty_level, category, points)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;
    const { rows } = await client.query(query, [
      data.anime_id, data.character_id || null, data.text, data.difficulty, data.category, data.points
    ]);
    return rows[0].id;
  }

  /**
   * Auxiliar para persistir a opção.
   */
  async saveOption(client, questionId, text, isCorrect) {
    const query = `
      INSERT INTO public.question_options (question_id, option_text, is_correct)
      VALUES ($1, $2, $3)
    `;
    await client.query(query, [questionId, text, isCorrect]);
  }
}

module.exports = QuestionGeneratorService;