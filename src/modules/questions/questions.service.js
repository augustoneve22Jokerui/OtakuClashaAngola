/**
 * ❓ OTAKU CLASH ANGOLA - QUESTIONS SERVICE
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Lógica de negócio para curadoria de questões, validação de respostas e motor de jogo.
 */

const BaseService = require('../../core/base/BaseService');
const questionsRepository = require('./questions.repository');
const AppError = require('../../core/errors/AppError');
const logger = require('../../config/logger');

class QuestionsService extends BaseService {
  constructor() {
    super(questionsRepository);
  }

  /**
   * 🎲 OBTÉM SET DE QUESTÕES PARA O JOGO
   * Busca questões aleatórias filtradas e formatadas para o cliente (sem a resposta correta).
   */
  async getRandomSet(filters) {
    try {
      const questions = await this.repository.getRandomQuestions({
        animeId: filters.animeId,
        difficulty: filters.difficulty,
        category: filters.category,
        limit: filters.limit || 10
      });

      if (!questions || questions.length === 0) {
        throw AppError.notFound('Não foram encontradas questões com os critérios informados.');
      }

      return questions;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error(`[QuestionsService:getRandomSet] Erro: ${error.message}`);
      throw AppError.internal('Falha ao gerar conjunto de questões para o desafio.');
    }
  }

  /**
   * 📑 LISTAGEM ADMINISTRATIVA (PAGINADA)
   */
  async listForAdmin(filters) {
    try {
      const { search, animeId, page = 1, limit = 20 } = filters;
      const offset = (page - 1) * limit;

      const items = await this.repository.findDetailed({
        search,
        animeId,
        limit,
        offset
      });

      const total = await this.repository.count(animeId ? { anime_id: animeId } : {});

      return {
        items,
        pagination: { total, page: parseInt(page), limit: parseInt(limit) }
      };
    } catch (error) {
      logger.error(`[QuestionsService:AdminList] Erro: ${error.message}`);
      throw error;
    }
  }

  /**
   * ✨ CRIA QUESTÃO COM OPÇÕES (ATÔMICO)
   * Garante que a questão e suas 4 alternativas sejam criadas simultaneamente.
   */
  async createWithChoices(questionData, options) {
    // Validação de Negócio: Deve haver exatamente uma opção correta
    const correctCount = options.filter(opt => opt.isCorrect).length;
    if (correctCount !== 1) {
      throw AppError.badRequest('A questão deve ter exatamente uma alternativa correta.');
    }

    return await this.executeInTransaction(async (client) => {
      // 1. Cria o enunciado da questão
      const question = await this.repository.create(questionData, client);

      // 2. Cria as opções vinculadas
      await this.repository.createOptions(question.id, options, client);

      logger.info(`[Questions:Create] Questão ${question.id} criada com ${options.length} opções.`);
      return question;
    });
  }

  /**
   * ✍️ ATUALIZA QUESTÃO E OPÇÕES
   * Se as opções forem enviadas, as antigas são removidas e substituídas.
   */
  async updateWithChoices(id, data, options = null) {
    return await this.executeInTransaction(async (client) => {
      // 1. Atualiza dados do enunciado
      const updatedQuestion = await this.repository.update(id, data, client);

      // 2. Se houver novas opções, substitui as antigas
      if (options && options.length > 0) {
        const correctCount = options.filter(opt => opt.isCorrect).length;
        if (correctCount !== 1) {
          throw AppError.badRequest('A atualização deve manter exatamente uma alternativa correta.');
        }

        await this.repository.deleteOptions(id, client);
        await this.repository.createOptions(id, options, client);
      }

      logger.info(`[Questions:Update] Questão ${id} atualizada.`);
      return updatedQuestion;
    });
  }

  /**
   * ✅ VALIDA RESPOSTA (SERVER-SIDE ONLY)
   * Verifica se o ID da opção enviada pelo utilizador é a correta.
   */
  async validateAnswer(questionId, optionId) {
    const correctOption = await this.repository.getCorrectOption(questionId);

    if (!correctOption) {
      logger.error(`[Questions:Validation] Questão ${questionId} sem opção correta definida!`);
      throw AppError.notFound('Erro na configuração da questão. Contacte o suporte.');
    }

    const isCorrect = correctOption.id === optionId;

    return {
      isCorrect,
      correctOptionId: isCorrect ? optionId : correctOption.id,
      text: correctOption.text // Opcional: Retorna o texto para feedback no frontend
    };
  }

  /**
   * 📊 MÉTRICAS PARA O DASHBOARD
   */
  async getMetrics() {
    const query = `
      SELECT 
        category, 
        COUNT(*) as count,
        AVG(difficulty_level)::numeric(10,2) as avg_difficulty
      FROM public.questions 
      GROUP BY category
    `;
    try {
      const { rows } = await this.repository.db.query(query);
      return rows;
    } catch (error) {
      return [];
    }
  }
}

module.exports = new QuestionsService();