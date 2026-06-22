const BaseController = require('../../core/base/BaseController');
const matchesService = require('./matches.service');

/**
 * MatchesController - Controlador para gestão de partidas, duelos e histórico de jogos.
 */
class MatchesController extends BaseController {
  constructor() {
    super();
  }

  /**
   * Inicializa uma nova partida ou duelo.
   * POST /api/v1/matches
   */
  async create(req, res) {
    const userId = req.user.id;
    const { type, entryFee, animeId } = req.body;

    const match = await matchesService.initMatch({
      userId,
      type,
      entryFee: parseFloat(entryFee) || 0,
      animeId
    });

    return this.created(res, match, 'Partida inicializada com sucesso. Aguardando oponente.');
  }

  /**
   * Entra em uma partida existente através do código da sala.
   * POST /api/v1/matches/join
   */
  async joinByCode(req, res) {
    const userId = req.user.id;
    const { roomCode } = req.body;

    const match = await matchesService.joinByCode(userId, roomCode);

    return this.success(res, match, 'Você entrou na partida com sucesso.');
  }

  /**
   * Obtém o histórico de partidas do usuário autenticado com paginação.
   * GET /api/v1/matches/history
   */
  async getMyHistory(req, res) {
    const userId = req.user.id;
    const { page, limit } = req.query;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;

    const history = await matchesService.getUserHistory(userId, pageNum, limitNum);
    
    // Contagem total para paginação
    const total = await matchesService.repository.count({ user_id: userId });

    return this.paginate(res, history, {
      total,
      page: pageNum,
      limit: limitNum
    });
  }

  /**
   * Obtém detalhes de uma partida específica.
   * GET /api/v1/matches/:id
   */
  async getDetails(req, res) {
    const { id } = req.params;
    
    const match = await matchesService.repository.findWithPlayers(id);
    
    if (!match) {
      return res.status(404).json({
        status: 'error',
        message: 'Partida não encontrada.'
      });
    }

    return this.success(res, match);
  }

  /**
   * Rota administrativa/interna para finalizar uma partida (em caso de falha no socket).
   * PATCH /api/v1/matches/:id/finish
   */
  async manualFinish(req, res) {
    const { id } = req.params;
    const { results } = req.body; // Array de resultados

    const result = await matchesService.finishAndReward(id, results);

    return this.success(res, result, 'Partida finalizada e recompensas distribuídas.');
  }
}

module.exports = new MatchesController();