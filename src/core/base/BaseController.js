/**
 * 🎮 OTAKU CLASH ANGOLA - BASE CONTROLLER
 * Versão: 2.0.0 - Enterprise Standard
 * Descrição: Classe abstrata que fornece utilitários de resposta HTTP e gestão de erros.
 */

const { catchAsync } = require('../errors/ErrorHandler');

class BaseController {
  constructor() {
    // Garante que o contexto 'this' seja preservado em métodos de classe quando usados em rotas
    this.safe = this.safe.bind(this);
  }

  /**
   * ✅ RESPOSTA DE SUCESSO (200 OK)
   * @param {Object} res - Express Response
   * @param {any} data - Carga útil da resposta
   * @param {string} message - Mensagem de contexto
   */
  success(res, data = {}, message = 'Operação realizada com sucesso.') {
    return res.status(200).json({
      status: 'success',
      message,
      data
    });
  }

  /**
   * ✨ RESPOSTA DE CRIAÇÃO (201 CREATED)
   * @param {Object} res 
   * @param {any} data 
   * @param {string} message 
   */
  created(res, data = {}, message = 'Recurso criado com sucesso.') {
    return res.status(201).json({
      status: 'success',
      message,
      data
    });
  }

  /**
   * 📄 RESPOSTA PAGINADA (200 OK)
   * Estrutura rigorosa para o componente de paginação do Frontend Admin.
   * @param {Object} res 
   * @param {Array} results - Itens da página atual
   * @param {Object} pagination - { total, page, limit }
   */
  paginate(res, results, pagination) {
    const total = parseInt(pagination.total) || 0;
    const limit = parseInt(pagination.limit) || 10;
    const page = parseInt(pagination.page) || 1;
    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      status: 'success',
      message: 'Resultados paginados recuperados.',
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      data: results
    });
  }

  /**
   * 💨 RESPOSTA SEM CONTEÚDO (204 NO CONTENT)
   */
  noContent(res) {
    return res.status(204).send();
  }

  /**
   * 🛡️ WRAPPER: SAFE METHOD
   * Encapsula métodos assíncronos para captura automática de exceções.
   * Uso nas rotas: router.get('/', controller.safe(controller.metodo))
   * @param {Function} fn - Método do controlador (async)
   */
  safe(fn) {
    // Vincula o contexto da instância do controller à função antes de passar para o catchAsync
    return catchAsync(fn.bind(this));
  }
}

module.exports = BaseController;