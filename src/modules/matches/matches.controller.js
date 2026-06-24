/**
 * 🎮 OTAKU CLASH ANGOLA - MATCHES CONTROLLER
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Gerencia o ciclo de vida das partidas, duelos e monitoramento de arena.
 */

const BaseController = require('../../core/base/BaseController');
const matchesService = require('./matches.service');
const MatchesDTO = require('./matches.dto');

class MatchesController extends BaseController {
  constructor() {
    super();
  }

  /**
   * 🏗️ INICIALIZAR NOVA PARTIDA (PLAYER ACTION)
   * POST /api/v1/matches
   */
  async create(req, res) {
    const userId = req.user.id;
    const { type, entryFee, animeId } = req.body;

    const match = await matchesService.initMatch({
      userId,
      type,
      entryFee: parseFloat(entryFee) || 0,
      animeId,
      maxPlayers: 2 // Duelo 1v1 padrão
    });

    const transformed = MatchesDTO.transform(match);
    return this.created(res, transformed, 'Partida inicializada com sucesso. Aguardando oponente.');
  }

  /**
   * 🔑 ENTRAR EM PARTIDA VIA CÓDIGO (PLAYER ACTION)
   * POST /api/v1/matches/join
   */
  async joinByCode(req, res) {
    const userId = req.user.id;
    const { roomCode } = req.body;

    const match = await matchesService.joinByCode(userId, roomCode);

    // Retorna detalhes completos incluindo o oponente para o App Flutter
    const transformed = MatchesDTO.transformDetails(match);
    return this.success(res, transformed, 'Entrada na arena confirmada.');
  }

  /**
   * 📑 HISTÓRICO PESSOAL DE PARTIDAS
   * GET /api/v1/matches/history
   */
  async getMyHistory(req, res) {
    const userId = req.user.id;
    const { page, limit } = req.query;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;

    const history = await matchesService.getUserHistory(userId, pageNum, limitNum);
    
    // Contagem total para o componente de paginação do App
    const total = await matchesService.repository.count({ user_id: userId });

    const transformedHistory = MatchesDTO.transformHistory(history);

    return this.paginate(res, transformedHistory, {
      total,
      page: pageNum,
      limit: limitNum
    });
  }

  /**
   * 🔍 DETALHES TÉCNICOS DA PARTIDA
   * GET /api/v1/matches/:id
   */
  async getDetails(req, res) {
    const { id } = req.params;
    
    const match = await matchesService.repository.findByIdWithPlayers(id);
    
    if (!match) {
      const AppError = require('../../core/errors/AppError');
      throw AppError.notFound('A partida solicitada não foi localizada.');
    }

    const transformed = MatchesDTO.transformDetails(match);
    return this.success(res, transformed);
  }

  /**
   * 🕵️ MONITOR DE ARENA: PARTIDAS ACTIVAS (ADMIN ONLY)
   * GET /api/v1/matches/admin/live
   */
  async listLive(req, res) {
    const liveMatches = await matchesService.getLiveMatches();
    
    // Transforma a lista para o formato simplificado do monitor
    const transformed = liveMatches.map(m => MatchesDTO.transform(m));
    
    return this.success(res, transformed, 'Arenas em combate recuperadas.');
  }

  /**
   * 🛠️ FINALIZAÇÃO MANUAL / RECONSTITUIÇÃO (ADMIN ACTION)
   * PATCH /api/v1/matches/:id/finish
   */
  async manualFinish(req, res) {
    const { id } = req.params;
    const { results } = req.body; // Array de resultados [{ userId, score, etc }]

    const result = await matchesService.finishAndReward(id, results);

    return this.success(res, result, 'A partida foi encerrada manualmente e os prêmios foram processados.');
  }

  /**
   * 🛑 ABORTAR PARTIDA (ADMIN ACTION)
   * PATCH /api/v1/matches/:id/abort
   */
  async abort(req, res) {
    const { id } = req.params;
    const { reason } = req.body;

    const aborted = await matchesService.abortMatch(id, reason);

    if (!aborted) {
      const AppError = require('../../core/errors/AppError');
      throw AppError.badRequest('Não é possível abortar uma partida já finalizada.');
    }

    return this.success(res, null, 'A arena foi encerrada administrativamente.');
  }
}

module.exports = new MatchesController();