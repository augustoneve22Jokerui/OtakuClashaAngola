/**
 * 🛰️ OTAKU CLASH ANGOLA - UPLOAD SERVICE
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Gerencia a persistência de ficheiros no Supabase Storage com nomes únicos.
 */

const { supabaseAdmin } = require('../../config/supabase');
const { getBucketName } = require('../../config/storage');
const logger = require('../../config/logger');
const AppError = require('../../core/errors/AppError');
const { v4: uuidv4 } = require('uuid');

class UploadService {
  constructor() {
    this.storage = supabaseAdmin.storage;
  }

  /**
   * 📤 REALIZA O UPLOAD DE UM FICHEIRO
   * @param {Object} file - Objeto do Multer contendo buffer e metadados.
   * @param {string} bucketType - Tipo do bucket (avatar, anime, character, quiz, tournament).
   * @param {string} [subFolder] - Subpasta opcional dentro do bucket.
   * @returns {Promise<Object>} Dados do ficheiro incluindo a URL pública.
   */
  async uploadFile(file, bucketType, subFolder = '') {
    try {
      if (!file || !file.buffer) {
        throw AppError.badRequest('Conteúdo do ficheiro inválido ou ausente.');
      }

      const bucketName = getBucketName(bucketType);
      
      // 1. Gera nome único preservando a extensão original
      const extension = file.originalname ? file.originalname.split('.').pop() : 'webp';
      const fileName = `${uuidv4()}.${extension}`;
      const filePath = subFolder ? `${subFolder}/${fileName}` : fileName;

      logger.debug(`[UploadService] Iniciando upload para ${bucketName}/${filePath}`);

      // 2. Executa o upload para o Supabase
      const { data, error } = await this.storage
        .from(bucketName)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype || 'image/webp',
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        logger.error(`[UploadService:Supabase] Erro: ${error.message}`);
        throw new AppError(`Falha ao persistir ficheiro no storage: ${error.message}`, 502);
      }

      // 3. Gera a URL Pública para acesso imediato
      const { data: { publicUrl } } = this.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      return {
        key: data.path,
        bucket: bucketName,
        url: publicUrl,
        size: file.size,
        mimetype: file.mimetype
      };

    } catch (error) {
      if (error instanceof AppError) throw error;
      
      logger.error(`[UploadService:Fatal] ${error.message}`);
      throw AppError.internal('Erro interno ao processar o upload do ficheiro.');
    }
  }

  /**
   * 🔑 GERA URL ASSINADA (TEMPORÁRIA)
   * Utilizado para ficheiros protegidos ou privados.
   */
  async getSignedUrl(bucketType, filePath, expiresIn = 3600) {
    try {
      const bucketName = getBucketName(bucketType);
      
      const { data, error } = await this.storage
        .from(bucketName)
        .createSignedUrl(filePath, expiresIn);

      if (error) throw error;

      return data.signedUrl;
    } catch (error) {
      logger.error(`[UploadService:SignedUrl] Erro: ${error.message}`);
      throw AppError.internal('Não foi possível gerar o link de acesso ao ficheiro.');
    }
  }

  /**
   * 🗑️ REMOVE FICHEIRO DO STORAGE
   */
  async removeFile(bucketType, filePath) {
    try {
      const bucketName = getBucketName(bucketType);
      const { data, error } = await this.storage
        .from(bucketName)
        .remove([filePath]);

      if (error) throw error;
      return data && data.length > 0;
    } catch (error) {
      logger.warn(`[UploadService:Remove] Falha ao apagar ${filePath}: ${error.message}`);
      return false;
    }
  }
}

module.exports = new UploadService();