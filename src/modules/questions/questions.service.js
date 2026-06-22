const BaseService = require('../../core/base/BaseService');
const questionsRepository = require('./questions.repository');
const AppError = require('../../core/errors/AppError');
const logger = require('../../config/logger');

/**
 * QuestionsService - Gerencia a lógica de negócio do banco de questões do quiz.
 */
class QuestionsService extends BaseService {
  constructor() {
    super(questionsRepository);
  }

  /**
   * Obtém um conjunto de questões aleatórias formatadas para uma partida.
   * @param {Object} filters - { animeId, difficulty, limit, category }
   */
  async getRandomSet(filters) {
    try {
      const questions = await this.repository.getRandomQuestions({
        animeId: filters.animeId,
        difficulty: filters.difficulty,
        limit: filters.limit || 10,
        category: filters.category
      });

      if (!questions || questions.length === 0) {
        throw AppError.notFound('Não foram encontradas questões com os critérios informados.');
      }

      // Mapeia para garantir que a propriedade is_correct não vaze se for um modo competitivo estrito
      // No entanto, para o Socket.io gerenciar a validação no server-side, enviamos as opções completas.
      return questions;
    } catch (error) {
      logger.error(`[QuestionsService] Erro ao obter set de questões: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cria uma nova questão com suas respectivas opções em uma transação atômica.
   * @param {Object} questionData - Dados da questão
   * @param {Array} options - Array de objetos { text, isCorrect }
   */
  async createWithOptions(questionData, options) {
    if (!options || options.length < 2) {
      throw AppError.badRequest('Uma questão deve ter pelo menos duas opções de resposta.');
    }

    const correctOptions = options.filter(opt => opt.isCorrect);
    if (correctOptions.length !== 1) {
      throw AppError.badRequest('Uma questão deve ter exatamente uma opção correta.');
    }

    return await this.executeInTransaction(async (client) => {
      // 1. Cria a questão
      const question = await this.repository.create(questionData, client);

      // 2. Cria as opções vinculadas
      await this.repository.createOptions(question.id, options, client);

      logger.info(`[QuestionsService] Nova questão criada ID: ${question.id}`);
      
      return question;
    });
  }

  /**
   * Lista questões detalhadas para a interface administrativa.
   */
  async listForAdmin(filters) {
    try {
      const { page = 1, limit = 20, animeId } = filters;
      const offset = (page - 1) * limit;

      const items = await this.repository.findDetailed({
        limit,
        offset,
        animeId
      });

      const total = await this.repository.count(animeId ? { anime_id: animeId } : {});

      return {
        items,
        pagination: {
          total,
          page,
          limit
        }
      };
    } catch (error) {
      logger.error(`[QuestionsService] Erro na listagem administrativa: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove uma questão e suas opções.
   * @param {string} id - UUID da questão.
   */
  async deleteQuestion(id) {
    return await this.executeInTransaction(async (client) => {
      // Remove opções primeiro devido à integridade referencial (embora haja ON DELETE CASCADE)
      await this.repository.deleteOptions(id, client);
      
      const deleted = await this.repository.delete(id, client);
      
      if (!deleted) {
        throw AppError.notFound('Questão não encontrada para exclusão.');
      }

      logger.info(`[QuestionsService] Questão removida: ${id}`);
      return true;
    });
  }

  /**
   * Valida se uma resposta está correta sem expor a lógica ao cliente.
   * @param {string} questionId 
   * @param {string} optionId 
   */
  async validateAnswer(questionId, optionId) {
    const correctOption = await this.repository.getCorrectOption(questionId);
    
    if (!correctOption) {
      throw AppError.notFound('Questão ou opção correta não localizada.');
    }

    return {
      isCorrect: correctOption.id === optionId,
      correctOptionId: correctOption.id
    };
  }
}

module.exports = new QuestionsService();