/**
 * 👤 OTAKU CLASH ANGOLA - CHARACTERS SERVICE
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Lógica de negócio para gestão de personagens, curadoria e suporte ao Quiz.
 */

const BaseService = require('../../core/base/BaseService');
const charactersRepository = require('./characters.repository');
const AppError = require('../../core/errors/AppError');
const logger = require('../../config/logger');
const uploadService = require('../../services/storage/UploadService');
const imageOptimizationService = require('../../services/storage/ImageOptimizationService');

class CharactersService extends BaseService {
  constructor() {
    super(charactersRepository);
  }

  /**
   * 📑 LISTAGEM DE PERSONAGENS COM FILTROS
   */
  async listCharacters(filters) {
    try {
      const { search, animeId, page = 1, limit = 10 } = filters;
      const offset = (page - 1) * limit;

      const items = await this.repository.findWithFilters({
        search,
        animeId,
        limit,
        offset
      });

      const total = await this.repository.countWithFilters({ search, animeId });

      return {
        items,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit)
        }
      };
    } catch (error) {
      logger.error(`[CharactersService:List] Erro: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🔍 OBTÉM DETALHES DO PERSONAGEM
   * Retorna os dados biográficos e o vínculo com a obra original.
   */
  async getCharacterDetails(id) {
    const character = await this.repository.findById(id);

    if (!character) {
      throw AppError.notFound('Personagem não localizado no catálogo.');
    }

    // Busca dados simplificados do anime vinculado para contexto
    const animeRepository = require('../animes/animes.repository');
    const anime = await animeRepository.findById(character.anime_id);

    return {
      ...character,
      anime: anime ? { id: anime.id, title: anime.title, imageUrl: anime.image_url } : null
    };
  }

  /**
   * 🎲 PERSONAGENS ALEATÓRIOS (PARA MOTOR DE QUIZ)
   * Utilizado para gerar distratores ou o modo "Quem é esse personagem?".
   */
  async getRandomForQuiz(limit = 4, excludeId = null) {
    try {
      return await this.repository.getRandomCharacters(limit, excludeId);
    } catch (error) {
      logger.error(`[CharactersService:Random] Falha ao obter aleatórios: ${error.message}`);
      return [];
    }
  }

  /**
   * ✍️ ATUALIZA OU CRIA PERSONAGEM COM OTIMIZAÇÃO DE IMAGEM
   */
  async upsertCharacter(id, data, imageFile = null) {
    return await this.executeInTransaction(async (client) => {
      
      // 1. Processamento de Imagem (se fornecida via upload manual)
      if (imageFile) {
        try {
          const optimizedBuffer = await imageOptimizationService.optimizeAvatar(imageFile.buffer);
          
          const uploadResult = await uploadService.uploadFile(
            { 
              buffer: optimizedBuffer, 
              mimetype: 'image/webp',
              originalname: `char_${data.name || 'new'}.webp`
            },
            'characters',
            `anime_${data.anime_id || 'general'}`
          );

          data.image_url = uploadResult.url;
        } catch (error) {
          logger.error(`[CharactersService:Image] Falha no processamento: ${error.message}`);
          throw AppError.unprocessable('Não foi possível processar a imagem do personagem.');
        }
      }

      // 2. Persistência (Update ou Create)
      let result;
      if (id) {
        result = await this.repository.update(id, data, client);
      } else {
        // Se vier da Jikan, usamos o mal_id como alvo de conflito
        if (data.mal_id) {
          result = await this.repository.syncUpsert(data, client);
        } else {
          result = await this.repository.create(data, client);
        }
      }

      return result;
    });
  }

  /**
   * 📊 MÉTRICAS DE PERSONAGENS (ADMIN)
   */
  async getMetrics() {
    return await this.repository.getCharacterStats();
  }
}

module.exports = new CharactersService();