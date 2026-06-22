/**
 * ResponseHelper - Padroniza todas as saídas da API Otaku Clash Angola.
 * Garante que o frontend receba uma estrutura previsível e consistente.
 */
class ResponseHelper {
  /**
   * Resposta de sucesso padrão (200 OK)
   * @param {Object} res - Express Response object
   * @param {any} data - Dados a serem enviados
   * @param {string} message - Mensagem de sucesso opcional
   */
  static success(res, data = null, message = 'Operação realizada com sucesso.') {
    return res.status(200).json({
      status: 'success',
      message,
      data,
    });
  }

  /**
   * Resposta de criação com sucesso (201 Created)
   * @param {Object} res 
   * @param {any} data 
   * @param {string} message 
   */
  static created(res, data = null, message = 'Recurso criado com sucesso.') {
    return res.status(201).json({
      status: 'success',
      message,
      data,
    });
  }

  /**
   * Resposta para dados paginados
   * @param {Object} res 
   * @param {Array} list - Lista de itens da página atual
   * @param {Object} meta - Metadados (total, page, limit)
   */
  static paginated(res, list, meta) {
    const total = parseInt(meta.total) || 0;
    const page = parseInt(meta.page) || 1;
    const limit = parseInt(meta.limit) || 10;
    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      status: 'success',
      data: list,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  }

  /**
   * Resposta de erro padronizada
   * @param {Object} res 
   * @param {string} message 
   * @param {number} statusCode 
   * @param {any} errors - Detalhes adicionais (erros de validação, etc)
   */
  static error(res, message = 'Ocorreu um erro interno.', statusCode = 500, errors = null) {
    const response = {
      status: 'error',
      message,
    };

    if (errors) {
      response.errors = errors;
    }

    return res.status(statusCode).json(response);
  }

  /**
   * Resposta de "No Content" (204)
   * @param {Object} res 
   */
  static noContent(res) {
    return res.status(204).send();
  }
}

module.exports = ResponseHelper;