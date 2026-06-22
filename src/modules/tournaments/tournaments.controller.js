const BaseController = require('../../core/base/BaseController');
const tournamentsService = require('./tournaments.service');
const TournamentsDTO = require('./tournaments.dto');

/**
 * TournamentsController - Gerencia as operações de torneios e grandes competições.
 */
class TournamentsController extends BaseController {
  constructor() {
    super();
  }

  /**
   * Lista torneios ativos e futuros com filtros e paginação.
   * GET /api/v1/tournaments
   */
  async list(req, res) {
    const { status, animeId, page, limit } = req.query;

    const result = await tournamentsService.listTournaments({
      status,
      animeId: animeId ? parseInt(animeId) : null,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10
    });

    const transformedItems = TournamentsDTO.transformMany(result.items);

    return this.paginate(res, transformedItems, result.pagination);
  }

  /**
   * Obtém os detalhes completos de um torneio específico, incluindo participantes.
   * GET /api/v1/tournaments/:id
   */
  async getDetails(req, res) {
    const { id } = req.params;

    const tournament = await tournamentsService.getTournamentDetails(id);
    const transformed = TournamentsDTO.transformDetails(tournament);

    return this.success(res, transformed, 'Detalhes do torneio recuperados.');
  }

  /**
   * Realiza a inscrição do usuário no torneio (Debita taxa se houver).
   * POST /api/v1/tournaments/:id/register
   */
  async register(req, res) {
    const userId = req.user.id;
    const { id: tournamentId } = req.params;

    const participant = await tournamentsService.registerUser(tournamentId, userId);

    return this.created(res, participant, 'Inscrição realizada com sucesso! Prepare sua estratégia.');
  }

  /**
   * Cancela a inscrição do usuário no torneio (Estorna taxa se em fase de registro).
   * DELETE /api/v1/tournaments/:id/unregister
   */
  async unregister(req, res) {
    const userId = req.user.id;
    const { id: tournamentId } = req.params;

    await tournamentsService.unregisterUser(tournamentId, userId);

    return this.success(res, null, 'Sua inscrição foi cancelada e o valor da taxa foi estornado para sua carteira.');
  }

  /**
   * Obtém a lista de torneios que o usuário autenticado está participando.
   * GET /api/v1/tournaments/me
   */
  async getMyTournaments(req, res) {
    const userId = req.user.id;
    
    const tournaments = await tournamentsService.repository.findUserTournaments(userId);
    const transformed = TournamentsDTO.transformMany(tournaments);

    return this.success(res, transformed, 'Seu histórico de torneios foi recuperado.');
  }

  /**
   * Altera o status do torneio (Apenas ADMIN).
   * PATCH /api/v1/tournaments/:id/status
   */
  async updateStatus(req, res) {
    const { id: tournamentId } = req.params;
    const { status } = req.body;

    const updatedTournament = await tournamentsService.updateStatus(tournamentId, status);

    return this.success(
      res, 
      TournamentsDTO.transform(updatedTournament), 
      `Status do torneio atualizado para ${status}.`
    );
  }
}

module.exports = new TournamentsController();