const { supabaseAdmin } = require('../../config/supabase');
const { getBucketName } = require('../../config/storage');
const logger = require('../../config/logger');
const AppError = require('../../core/errors/AppError');

/**
 * DeleteFileService - Responsável pela remoção de arquivos do Supabase Storage.
 */
class DeleteFileService {
  constructor() {
    this.storage = supabaseAdmin.storage;
  }

  /**
   * Remove um único arquivo de um bucket específico.
   * 
   * @param {string} bucketType - Tipo do bucket (avatar, anime, character, quiz, tournament)
   * @param {string} filePath - Caminho/Key do arquivo dentro do bucket
   * @returns {Promise<boolean>} Retorna true se a remoção foi bem-sucedida
   */
  async deleteFile(bucketType, filePath) {
    try {
      if (!filePath) {
        logger.warn('[DeleteFileService] Tentativa de exclusão com filePath vazio.');
        return false;
      }

      const bucketName = getBucketName(bucketType);

      logger.info(`[DeleteFileService] Removendo arquivo: ${filePath} do bucket: ${bucketName}`);

      const { data, error } = await this.storage
        .from(bucketName)
        .remove([filePath]);

      if (error) {
        logger.error(`[DeleteFileService] Erro ao remover arquivo do Supabase: ${error.message}`);
        throw new AppError(`Erro ao excluir arquivo do storage: ${error.message}`, 500);
      }

      // O Supabase retorna uma lista de arquivos removidos. Validamos se o arquivo alvo está nela.
      const isDeleted = data && data.length > 0;

      if (!isDeleted) {
        logger.warn(`[DeleteFileService] Arquivo não encontrado para exclusão: ${filePath}`);
      }

      return isDeleted;
    } catch (error) {
      if (error instanceof AppError) throw error;
      
      logger.error(`[DeleteFileService] Erro inesperado ao deletar: ${error.message}`);
      throw AppError.internal('Erro interno ao processar a exclusão do arquivo.');
    }
  }

  /**
   * Remove múltiplos arquivos de uma só vez.
   * 
   * @param {string} bucketType 
   * @param {string[]} filePaths - Array de caminhos/keys
   */
  async deleteMultipleFiles(bucketType, filePaths) {
    try {
      if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0) {
        return false;
      }

      const bucketName = getBucketName(bucketType);

      logger.info(`[DeleteFileService] Removendo lote de ${filePaths.length} arquivos do bucket: ${bucketName}`);

      const { data, error } = await this.storage
        .from(bucketName)
        .remove(filePaths);

      if (error) {
        logger.error(`[DeleteFileService] Erro na exclusão em lote: ${error.message}`);
        throw new AppError('Erro ao excluir lote de arquivos.', 500);
      }

      logger.info(`[DeleteFileService] Exclusão em lote finalizada. Removidos: ${data?.length || 0}`);
      return true;
    } catch (error) {
      logger.error(`[DeleteFileService] Erro inesperado no lote: ${error.message}`);
      throw AppError.internal('Erro ao processar exclusão em massa.');
    }
  }
}

module.exports = new DeleteFileService();