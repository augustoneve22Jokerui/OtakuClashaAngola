const { catchAsync } = require('../errors/ErrorHandler');

/**
 * BaseController - Classe base para todos os controllers da aplicação.
 * Fornece métodos utilitários para padronizar respostas HTTP.
 */
class BaseController {
  constructor() {
    // Faz o bind automático dos métodos para garantir o contexto 'this' se necessário
    // mas a abordagem preferida é usar catchAsync em métodos estáticos ou instanciados.
  }

  /**
   * Envia uma resposta de sucesso (200 OK)
   */
  success(res, data = {}, message = 'Operação realizada com sucesso.') {
    return res.status(200).json({
      status: 'success',
      message,
      data,
    });
  }

  /**
   * Envia uma resposta de criação (201 Created)
   */
  created(res, data = {}, message = 'Recurso criado com sucesso.') {
    return res.status(201).json({
      status: 'success',
      message,
      data,
    });
  }

  /**
   * Envia uma resposta sem conteúdo (204 No Content)
   */
  noContent(res) {
    return res.status(204).send();
  }

  /**
   * Envia uma resposta de paginação padronizada
   * @param {Object} res - Express Response
   * @param {Array} results - Lista de itens
   * @param {Object} pagination - Metadados: page, limit, total, totalPages
   */
  paginate(res, results, pagination) {
    return res.status(200).json({
      status: 'success',
      pagination: {
        total: parseInt(pagination.total),
        page: parseInt(pagination.page),
        limit: parseInt(pagination.limit),
        totalPages: Math.ceil(pagination.total / pagination.limit),
      },
      data: results,
    });
  }

  /**
   * Wrapper para capturar erros assíncronos em métodos de instância
   * @param {Function} fn - Função/Método do controller
   */
  safe(fn) {
    return catchAsync(fn.bind(this));
  }
}

module.exports = BaseController;