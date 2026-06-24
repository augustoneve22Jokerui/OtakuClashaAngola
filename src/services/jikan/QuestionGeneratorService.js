/**
 * 🧠 OTAKU CLASH ANGOLA - QUESTION GENERATOR SERVICE
 * Versão: 2.0.0 - Enterprise Grade (Automated Content)
 * Descrição: Gera automaticamente questões de quiz baseadas nos metadados do catálogo.
 */
const db = require('../../config/database');
const logger = require('../../config/logger');
const AppError = require('../../core/errors/AppError');

class QuestionGeneratorService {
  /**
   * 🚀 GERA QUESTÕES PARA UMA OBRA ESPECÍFICA
   * @param {number} animeId - ID local do anime.
   */
  async generateForAnime(animeId) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      // 1. Busca dados da obra e dos personagens sincronizados
      const animeQuery = `SELECT * FROM public.animes WHERE id = $1`;
      const charQuery = `SELECT * FROM public.characters WHERE anime_id = $1 LIMIT 10`;
      
      const { rows: [anime] } = await client.query(animeQuery, [animeId]);
      const { rows: characters } = await client.query(charQuery, [animeId]);

      if (!anime || characters.length === 0) {
        logger.warn(`[Generator] Dados insuficientes para o anime ID ${animeId}. Abortando.`);
        await client.query('ROLLBACK');
        return false;
      }

      logger.info(`[Generator] Iniciando produção de conteúdo para: ${anime.title}`);

      // 2. Produção: Questões de Personagem ("Quem é este personagem?")
      for (const char of characters) {
        await this._createCharacterAssociationQuestion(client, anime, char);
      }

      // 3. Produção: Questões de Metadados ("Qual o género de X?")
      await this._createAnimeMetadataQuestion(client, anime);

      await client.query('COMMIT');
      logger.info(`[Generator] Sucesso. Conteúdo gerado para o anime: ${anime.title}`);
      return true;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`[Generator:Fail] Erro ao processar anime ${animeId}: ${error.message}`);
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * 👥 GERA QUESTÃO: ASSOCIAÇÃO PERSONAGEM -> OBRA (PRIVATE)
   */
  async _createCharacterAssociationQuestion(client, anime, character) {
    const text = `O personagem "${character.name}" pertence a qual destas obras de anime?`;
    
    // Busca 3 animes aleatórios DIFERENTES do atual como distratores
    const distractorsQuery = `
      SELECT title FROM public.animes 
      WHERE id != $1 
      ORDER BY RANDOM() 
      LIMIT 3
    `;
    const { rows: distractors } = await client.query(distractorsQuery, [anime.id]);

    if (distractors.length < 3) return; // Evita questões com poucas opções

    // Cria a questão base
    const questionId = await this._persistQuestion(client, {
      anime_id: anime.id,
      character_id: character.id,
      text: text,
      difficulty: character.role === 'Main' ? 1 : 2,
      category: 'CHARACTER',
      points: 10
    });

    // Insere a opção correta
    await this._persistOption(client, questionId, anime.title, true);

    // Insere as opções incorretas
    for (const dist of distractors) {
      await this._persistOption(client, questionId, dist.title, false);
    }
  }

  /**
   * 🏷️ GERA QUESTÃO: METADADOS / GÊNERO (PRIVATE)
   */
  async _createAnimeMetadataQuestion(client, anime) {
    const genres = typeof anime.genres === 'string' ? JSON.parse(anime.genres) : anime.genres;
    if (!genres || genres.length === 0) return;

    const correctGenre = genres[0];
    const text = `Qual é um dos géneros principais atribuídos à obra "${anime.title}"?`;

    // Busca géneros que NÃO pertencem a este anime como distratores
    const distractorsQuery = `
      SELECT DISTINCT jsonb_array_elements_text(genres) as g 
      FROM public.animes 
      WHERE NOT (genres @> $1::jsonb)
      LIMIT 3
    `;
    const { rows: distractors } = await client.query(distractorsQuery, [JSON.stringify([correctGenre])]);

    if (distractors.length < 3) return;

    const questionId = await this._persistQuestion(client, {
      anime_id: anime.id,
      text: text,
      difficulty: 2,
      category: 'ANIME',
      points: 15
    });

    await this._persistOption(client, questionId, correctGenre, true);
    for (const dist of distractors) {
      await this._persistOption(client, questionId, dist.g, false);
    }
  }

  /**
   * 💾 PERSISTÊNCIA DE QUESTÃO (HELPER)
   */
  async _persistQuestion(client, data) {
    const query = `
      INSERT INTO public.questions (
        anime_id, character_id, question_text, difficulty_level, category, points, time_limit
      )
      VALUES ($1, $2, $3, $4, $5, $6, 15)
      RETURNING id
    `;
    const values = [
      data.anime_id,
      data.character_id || null,
      data.text,
      data.difficulty,
      data.category,
      data.points
    ];
    const { rows } = await client.query(query, values);
    return rows[0].id;
  }

  /**
   * 💾 PERSISTÊNCIA DE OPÇÃO (HELPER)
   */
  async _persistOption(client, questionId, text, isCorrect) {
    const query = `
      INSERT INTO public.question_options (question_id, option_text, is_correct)
      VALUES ($1, $2, $3)
    `;
    await client.query(query, [questionId, text, isCorrect]);
  }
}

module.exports = new QuestionGeneratorService();
