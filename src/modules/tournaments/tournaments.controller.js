/**
 * 🏆 OTAKU CLASH ANGOLA - TOURNAMENTS CONTROLLER
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Gerencia requisições para competições oficiais, inscrições e gestão de eventos.
 */

const BaseController = require('../../core/base/BaseController');
const tournamentsService = require('./tournaments.service');

class TournamentsController extends BaseController {
  constructor() {
    super();
  }

  /**
   * 📑 LISTAGEM DE TORNEIOS (PLAYER / ADMIN VIEW)
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

    // Retorna utilizando o padrão de paginação da BaseController para o Dashboard/App
    return this.paginate(res, result.items, result.pagination);
  }

  /**
   * 🔍 DETALHES COMPLETOS E LISTA DE PARTICIPANTES
   * GET /api/v1/tournaments/:id
   */
  async getDetails(req, res) {
    const { id } = req.params;

    const tournament = await tournamentsService.getTournamentDetails(id);

    return this.success(res, tournament, 'Ficha técnica do torneio recuperada.');
  }

  /**
   * ✍️ INSCRIÇÃO NO TORNEIO (PLAYER ACTION)
   * Realiza validação de nível e débito de taxa.
   * POST /api/v1/tournaments/:id/register
   */
  async register(req, res) {
    const userId = req.user.id;
    const { id: tournamentId } = req.params;

    const participant = await tournamentsService.registerUser(tournamentId, userId);

    return this.created(
      res, 
      participant, 
      'Inscrição confirmada com sucesso! Prepara-te para a arena.'
    );
  }

  /**
   * 🏃 CANCELAMENTO DE INSCRIÇÃO (PLAYER ACTION)
   * DELETE /api/v1/tournaments/:id/unregister
   */
  async unregister(req, res) {
    const userId = req.user.id;
    const { id: tournamentId } = req.params;

    await tournamentsService.unregisterUser(tournamentId, userId);

    return this.success(
      res, 
      null, 
      'Tua inscrição foi cancelada e o valor da taxa (se aplicável) foi estornado.'
    );
  }

  /**
   * 🆔 MEUS TORNEIOS (PLAYER VIEW)
   * GET /api/v1/tournaments/me/participation
   */
  async getMyTournaments(req, res) {
    const userId = req.user.id;
    
    const tournaments = await tournamentsService.repository.findByUserId(userId);
    
    return this.success(res, tournaments, 'O teu histórico de competições foi recuperado.');
  }

  /**
   * 🚦 ATUALIZAR STATUS OPERACIONAL (STAFF ACTION)
   * PATCH /api/v1/tournaments/:id/status
   */
  async updateStatus(req, res) {
    const { id: tournamentId } = req.params;
    const { status } = req.body; // 'REGISTRATION', 'IN_PROGRESS', 'FINISHED', 'CANCELLED'

    const updatedTournament = await tournamentsService.updateStatus(tournamentId, status);

    return this.success(
      res, 
      updatedTournament, 
      `Estado do torneio alterado para ${status} com sucesso.`
    );
  }

  /**
   * 🏗️ CRIAR OU ATUALIZAR TORNEIO (ADMIN ACTION)
   * POST /api/v1/tournaments OU PATCH /api/v1/tournaments/:id
   */
  async save(req, res) {
    const { id } = req.params; // Presente apenas em PATCH
    const tournamentData = {
      name: req.body.name,
      description: req.body.description,
      anime_id: req.body.anime_id ? parseInt(req.body.anime_id) : null,
      min_level: parseInt(req.body.min_level) || 1,
      max_participants: parseInt(req.body.max_participants) || 64,
      entry_fee: parseFloat(req.body.entry_fee) || 0,
      prize_pool: parseFloat(req.body.prize_pool) || 0,
      registration_opens_at: req.body.registration_opens_at,
      start_at: req.body.start_at,
      banner_url: req.body.banner_url
    };

    let result;
    if (id) {
      result = await tournamentsService.update(id, tournamentData);
    } else {
      result = await tournamentsService.create({
        ...tournamentData,
        status: 'REGISTRATION' // Inicia sempre em fase de inscrição
      });
    }

    return this.success(res, result, `O torneio foi ${id ? 'actualizado' : 'publicado'} com sucesso.`);
  }
}

module.exports = new TournamentsController();