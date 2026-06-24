/**
 * ⚔️ OTAKU CLASH ANGOLA - BATTLE ROYALE CONTROLLER
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Gerencia as requisições HTTP para criação, listagem e entrada em arenas massivas.
 */

const BaseController = require('../../core/base/BaseController');
const battleRoyaleService = require('./battleRoyale.service');
const db = require('../../config/database');
const logger = require('../../config/logger');

class BattleRoyaleController extends BaseController {
  constructor() {
    super();
  }

  /**
   * 📑 LISTA ARENAS ACTIVAS
   * Retorna todas as partidas do tipo BATTLE_ROYALE que não foram finalizadas.
   * GET /api/v1/battle-royale/rooms
   */
  async listRooms(req, res) {
    const { status } = req.query;
    
    // Busca arenas na tabela central de partidas
    const query = `
      SELECT 
        m.*, 
        a.title as "animeTitle",
        (SELECT COUNT(*) FROM public.match_players WHERE match_id = m.id) as "currentPlayers"
      FROM public.matches m
      LEFT JOIN public.animes a ON m.anime_id = a.id
      WHERE m.type = 'BATTLE_ROYALE' 
      ${status ? 'AND m.status = $1' : "AND m.status != 'FINISHED'"}
      ORDER BY m.created_at DESC
    `;
    
    const params = status ? [status] : [];
    
    try {
      const { rows } = await db.query(query, params);
      return this.success(res, rows, 'Arenas de Battle Royale recuperadas.');
    } catch (error) {
      logger.error(`[BR:Controller:List] Erro: ${error.message}`);
      return this.success(res, [], 'Nenhuma arena disponível no momento.');
    }
  }

  /**
   * 🏗️ CRIAR NOVA ARENA (STAFF ACTION)
   * POST /api/v1/battle-royale/rooms
   */
  async createRoom(req, res) {
    const { title, anime_id, entry_fee, max_players } = req.body;

    const room = await battleRoyaleService.createRoom({
      title,
      anime_id: parseInt(anime_id),
      entry_fee: parseFloat(entry_fee) || 0,
      max_players: parseInt(max_players) || 100
    });

    return this.created(res, room, 'Arena de Battle Royale aberta com sucesso.');
  }

  /**
   * 🏃 INSCRIÇÃO EM ARENA (PLAYER ACTION)
   * Realiza validação de saldo e reserva de vaga.
   * POST /api/v1/battle-royale/rooms/:matchId/join
   */
  async joinRoom(req, res) {
    const { matchId } = req.params;
    const userId = req.user.id;

    // O Service gerencia a transação bancária e a inserção na partida
    const result = await battleRoyaleService.joinBattleRoyale(userId, matchId);

    return this.success(
      res, 
      result, 
      'Inscrição confirmada! Aguarde o início da partida no lobby.'
    );
  }

  /**
   * 🔍 DETALHES TÉCNICOS DA ARENA
   * GET /api/v1/battle-royale/rooms/:matchId
   */
  async getRoomDetails(req, res) {
    const { matchId } = req.params;

    const query = `
      SELECT 
        m.*, 
        a.title as "animeTitle",
        a.image_url as "animeImage",
        COUNT(mp.user_id) as "survivors"
      FROM public.matches m
      LEFT JOIN public.animes a ON m.anime_id = a.id
      LEFT JOIN public.match_players mp ON m.id = mp.match_id
      WHERE m.id = $1 AND m.type = 'BATTLE_ROYALE'
      GROUP BY m.id, a.title, a.image_url
    `;
    
    const { rows } = await db.query(query, [matchId]);

    if (rows.length === 0) {
      const AppError = require('../../core/errors/AppError');
      throw AppError.notFound('Arena não localizada ou ID inválido.');
    }

    return this.success(res, rows[0]);
  }

  /**
   * 🏆 FEED DE VENCEDORES RECENTES
   * GET /api/v1/battle-royale/winners
   */
  async getRecentWinners(req, res) {
    const query = `
      SELECT 
        m.id as "matchId", 
        m.ended_at as "date", 
        p.username, 
        p.avatar_url as "avatarUrl", 
        m.prize_pool as "prize"
      FROM public.matches m
      JOIN public.profiles p ON m.winner_id = p.id
      WHERE m.type = 'BATTLE_ROYALE' 
      AND m.status = 'FINISHED'
      AND m.winner_id IS NOT NULL
      ORDER BY m.ended_at DESC
      LIMIT 10
    `;
    
    const { rows } = await db.query(query);

    return this.success(res, rows, 'Feed de lendas do Battle Royale recuperado.');
  }
}

module.exports = new BattleRoyaleController();