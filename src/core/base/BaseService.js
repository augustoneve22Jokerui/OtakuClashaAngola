const AppError = require('../errors/AppError');
const logger = require('../../config/logger');

/**
 * BaseService - Classe abstrata para a camada de serviços.
 * Centraliza a lógica de negócio e a comunicação com os repositórios.
 */
class BaseService {
  /**
   * @param {Object} repository - Instância do repositório principal do módulo.
   */
  constructor(repository) {
    this.repository = repository;
  }

  /**
   * Busca todos os registros com suporte a filtros básicos.
   */
  async findAll(filters = {}) {
    try {
      return await this.repository.findAll(filters);
    } catch (error) {
      logger.error(`[BaseService] Error in findAll: ${error.message}`);
      throw error;
    }
  }

  /**
   * Busca um registro por ID. Lança erro se não encontrado.
   */
  async findById(id) {
    if (!id) {
      throw AppError.badRequest('ID é obrigatório para esta operação.');
    }

    const item = await this.repository.findById(id);
    
    if (!item) {
      throw AppError.notFound('O registro solicitado não foi encontrado.');
    }

    return item;
  }

  /**
   * Cria um novo registro após validação básica.
   */
  async create(data) {
    try {
      return await this.repository.create(data);
    } catch (error) {
      logger.error(`[BaseService] Error in create: ${error.message}`);
      // Repassa o erro para o ErrorHandler tratar (ex: Unique Constraint)
      throw error;
    }
  }

  /**
   * Atualiza um registro existente.
   */
  async update(id, data) {
    // Garante que o registro existe antes de tentar atualizar
    await this.findById(id);

    try {
      return await this.repository.update(id, data);
    } catch (error) {
      logger.error(`[BaseService] Error in update: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove um registro.
   */
  async delete(id) {
    // Garante que o registro existe antes de tentar remover
    await this.findById(id);

    try {
      return await this.repository.delete(id);
    } catch (error) {
      logger.error(`[BaseService] Error in delete: ${error.message}`);
      throw error;
    }
  }

  /**
   * Executa uma operação dentro de uma transação gerenciada.
   * @param {Function} work - Função assíncrona que contém as operações do repositório.
   */
  async executeInTransaction(work) {
    const client = await this.repository.getDatabaseClient();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`[BaseService] Transaction failed and rolled back: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = BaseService;