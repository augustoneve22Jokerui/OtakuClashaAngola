/**
 * 🖼️ OTAKU CLASH ANGOLA - IMAGE OPTIMIZATION SERVICE
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Pipeline de processamento de imagem para alta performance e baixo consumo de dados.
 */

const sharp = require('sharp');
const storageConfig = require('../../config/storage');
const logger = require('../../config/logger');
const AppError = require('../../core/errors/AppError');

class ImageOptimizationService {
  /**
   * 👤 OTIMIZAÇÃO DE AVATAR (PLAYER/ADMIN)
   * Redimensiona para quadrado e converte para WebP.
   * @param {Buffer} buffer - Conteúdo bruto da imagem.
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
      logger.error(`[ImageOpt:Avatar] Falha: ${error.message}`);
      throw AppError.unprocessable('O processamento da imagem de perfil falhou.');
    }
  }

  /**
   * 🏆 OTIMIZAÇÃO DE BANNER (TORNEIOS/GUILDAS)
   * Formato Wide otimizado para capas e cabeçalhos.
   */
  async optimizeBanner(buffer) {
    try {
      const { width, height, quality } = storageConfig.optimization.banner;

      return await sharp(buffer)
        .resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .webp({ quality })
        .toBuffer();
    } catch (error) {
      logger.error(`[ImageOpt:Banner] Falha: ${error.message}`);
      throw AppError.unprocessable('O processamento do banner falhou.');
    }
  }

  /**
   * ❓ OTIMIZAÇÃO DE IMAGEM PARA QUIZ
   * Balanceamento entre nitidez e peso para carregamento instantâneo.
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
      logger.error(`[ImageOpt:Quiz] Falha: ${error.message}`);
      throw AppError.unprocessable('O processamento da imagem de desafio falhou.');
    }
  }

  /**
   * 🔄 CONVERSÃO GENÉRICA PARA WEBP
   * Mantém dimensões originais mas otimiza o peso.
   */
  async convertToWebP(buffer, quality = 80) {
    try {
      return await sharp(buffer)
        .webp({ quality })
        .toBuffer();
    } catch (error) {
      logger.error(`[ImageOpt:Convert] Falha: ${error.message}`);
      throw AppError.unprocessable('Falha na conversão de formato de imagem.');
    }
  }

  /**
   * 🔍 INSPEÇÃO DE METADADOS
   * Retorna dimensões e formato para validação.
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
      logger.error(`[ImageOpt:Meta] Falha na leitura: ${error.message}`);
      return null;
    }
  }
}

module.exports = new ImageOptimizationService();