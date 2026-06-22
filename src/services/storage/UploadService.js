const { supabaseAdmin } = require('../../config/supabase');
const { getBucketName } = require('../../config/storage');
const logger = require('../../config/logger');
const AppError = require('../../core/errors/AppError');
const { v4: uuidv4 } = require('uuid');

/**
 * UploadService - Gerencia o envio de arquivos para o Supabase Storage.
 */
class UploadService {
  constructor() {
    this.storage = supabaseAdmin.storage;
  }

  /**
   * Realiza o upload de um arquivo para um bucket específico.
   * 
   * @param {Object} file - Objeto de arquivo do Express/Multer (com buffer)
   * @param {string} bucketType - Tipo do bucket (avatar, anime, character, quiz, tournament)
   * @param {string} [folder] - Subpasta opcional dentro do bucket
   * @returns {Promise<Object>} Dados do arquivo enviado incluindo a URL pública
   */
  async uploadFile(file, bucketType, folder = '') {
    try {
      if (!file || !file.buffer) {
        throw AppError.badRequest('Arquivo não fornecido ou buffer inválido.');
      }

      const bucketName = getBucketName(bucketType);
      
      // Gera um nome de arquivo único para evitar colisões
      const fileExtension = file.originalname.split('.').pop();
      const fileName = `${uuidv4()}.${fileExtension}`;
      const filePath = folder ? `${folder}/${fileName}` : fileName;

      logger.info(`[UploadService] Iniciando upload para bucket: ${bucketName}, caminho: ${filePath}`);

      // Realiza o upload para o Supabase Storage
      const { data, error } = await this.storage
        .from(bucketName)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        logger.error(`[UploadService] Erro no Supabase Storage: ${error.message}`);
        throw new AppError(`Falha ao subir arquivo para o storage: ${error.message}`, 500);
      }

      // Obtém a URL pública do arquivo
      const { data: { publicUrl } } = this.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      return {
        key: data.path,
        bucket: bucketName,
        url: publicUrl,
        mimetype: file.mimetype,
        size: file.size
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      
      logger.error(`[UploadService] Erro inesperado: ${error.message}`);
      throw AppError.internal('Erro ao processar o upload do arquivo.');
    }
  }

  /**
   * Gera uma URL assinada (temporária) para arquivos privados.
   * 
   * @param {string} bucketType 
   * @param {string} filePath 
   * @param {number} expiresIn - Tempo de expiração em segundos
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
      logger.error(`[UploadService] Erro ao gerar URL assinada: ${error.message}`);
      throw AppError.internal('Não foi possível gerar o link de acesso ao arquivo.');
    }
  }
}

module.exports = new UploadService();