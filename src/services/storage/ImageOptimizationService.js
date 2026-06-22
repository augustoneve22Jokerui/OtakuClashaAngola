const sharp = require('sharp');
const storageConfig = require('../../config/storage');
const logger = require('../../config/logger');
const AppError = require('../../core/errors/AppError');

/**
 * ImageOptimizationService - Serviço especializado em processamento de imagens.
 * Otimiza mídias para reduzir consumo de dados e melhorar tempo de resposta.
 */
class ImageOptimizationService {
  /**
   * Otimiza uma imagem de perfil (Avatar).
   * @param {Buffer} buffer - Buffer original da imagem.
   * @returns {Promise<Buffer>} Buffer processado.
   */
  async optimizeAvatar(buffer) {
    try {
      const { width, height, quality } = storageConfig.optimization.avatar;
      
      return await sharp(buffer)
        .resize(width, height, {
          fit: 'cover',
          position: 'center'
        })
        .webp({ quality })
        .toBuffer();
    } catch (error) {
      logger.error(`[ImageOptimization] Erro ao otimizar avatar: ${error.message}`);
      throw new AppError('Falha ao processar imagem de avatar.', 422);
    }
  }

  /**
   * Otimiza banners de torneios ou clãs.
   * @param {Buffer} buffer 
   */
  async optimizeBanner(buffer) {
    try {
      const { width, height, quality } = storageConfig.optimization.banner;

      return await sharp(buffer)
        .resize(width, height, {
          fit: 'cover'
        })
        .webp({ quality })
        .toBuffer();
    } catch (error) {
      logger.error(`[ImageOptimization] Erro ao otimizar banner: ${error.message}`);
      throw new AppError('Falha ao processar banner.', 422);
    }
  }

  /**
   * Otimiza imagens para questões de quiz.
   * @param {Buffer} buffer 
   */
  async optimizeQuizImage(buffer) {
    try {
      const { width, height, quality } = storageConfig.optimization.quiz;

      return await sharp(buffer)
        .resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .webp({ quality })
        .toBuffer();
    } catch (error) {
      logger.error(`[ImageOptimization] Erro ao otimizar imagem de quiz: ${error.message}`);
      throw new AppError('Falha ao processar imagem de quiz.', 422);
    }
  }

  /**
   * Método genérico para conversão rápida para WebP sem redimensionamento.
   * @param {Buffer} buffer 
   * @param {number} quality 
   */
  async convertToWebP(buffer, quality = 80) {
    try {
      return await sharp(buffer)
        .webp({ quality })
        .toBuffer();
    } catch (error) {
      logger.error(`[ImageOptimization] Erro na conversão WebP: ${error.message}`);
      throw new AppError('Falha ao converter formato da imagem.', 422);
    }
  }

  /**
   * Extrai metadados básicos de uma imagem.
   * @param {Buffer} buffer 
   */
  async getMetadata(buffer) {
    try {
      const metadata = await sharp(buffer).metadata();
      return {
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        size: metadata.size
      };
    } catch (error) {
      logger.error(`[ImageOptimization] Erro ao ler metadados: ${error.message}`);
      return null;
    }
  }
}

module.exports = new ImageOptimizationService();