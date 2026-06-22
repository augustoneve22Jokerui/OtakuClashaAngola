const BaseController = require('../../core/base/BaseController');
const battleRoyaleService = require('./battleRoyale.service');
const { Roles } = require('../../core/constants/Roles');

/**
 * BattleRoyaleController - Controlador para gestão de sessões de Battle Royale.
 */
class BattleRoyaleController extends BaseController {
  constructor() {
    super();
  }

  /**
   * Lista todas as salas de Battle Royale ativas ou em espera.
   * GET /api/v1/battle-royale/rooms
   */
  async listRooms(req, res) {
    const { status } = req.query;
    
    // Busca na tabela de matches filtrando por tipo Battle Royale
    const query = `
      SELECT m.*, a.title as anime_title 
      FROM public.matches m
      LEFT JOIN public.animes a ON m.anime_id = a.id
      WHERE m.type = 'BATTLE_ROYALE' 
      ${status ? 'AND m.status = $1' : 'AND m.status != \'FINISHED\''}
      ORDER BY m.created_at DESC
    `;
    
    const params = status ? [status] : [];
    const { rows } = await require('../../config/database').query(query, params);

    return this.success(res, rows, 'Salas de Battle Royale recuperadas.');
  }

  /**
   * Cria uma nova sala de Battle Royale (Apenas Admin/Moderador).
   * POST /api/v1/battle-royale/rooms
   */
  async createRoom(req, res) {
    const { title, anime_id, entry_fee, max_players } = req.body;

    const room = await battleRoyaleService.createRoom({
      title,
      anime_id,
      entry_fee: parseFloat(entry_fee) || 0,
      max_players: parseInt(max_players) || 100
    });

    return this.created(res, room.rows[0], 'Sala de Battle Royale criada com sucesso.');
  }

  /**
   * Realiza a inscrição de um jogador em uma sala (Valida saldo e vaga).
   * POST /api/v1/battle-royale/rooms/:matchId/join
   */
  async joinRoom(req, res) {
    const { matchId } = req.params;
    const userId = req.user.id;

    const result = await battleRoyaleService.joinBattleRoyale(userId, matchId);

    return this.success(res, result, 'Inscrição confirmada. Conecte-se ao socket para jogar.');
  }

  /**
   * Obtém detalhes de uma sala específica.
   * GET /api/v1/battle-royale/rooms/:matchId
   */
  async getRoomDetails(req, res) {
    const { matchId } = req.params;

    const query = `
      SELECT m.*, 
             COUNT(mp.user_id) as current_players
      FROM public.matches m
      LEFT JOIN public.match_players mp ON m.id = mp.match_id
      WHERE m.id = $1 AND m.type = 'BATTLE_ROYALE'
      GROUP BY m.id
    `;
    
    const { rows } = await require('../../config/database').query(query, [matchId]);

    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Sala não encontrada.' });
    }

    return this.success(res, rows[0]);
  }

  /**
   * Retorna os últimos vencedores do modo Battle Royale.
   * GET /api/v1/battle-royale/winners
   */
  async getRecentWinners(req, res) {
    const query = `
      SELECT m.id as match_id, m.ended_at, p.username, p.avatar_url, m.prize_pool
      FROM public.matches m
      JOIN public.profiles p ON m.winner_id = p.id
      WHERE m.type = 'BATTLE_ROYALE' AND m.status = 'FINISHED'
      ORDER BY m.ended_at DESC
      LIMIT 10
    `;
    
    const { rows } = await require('../../config/database').query(query);

    return this.success(res, rows, 'Lista de vencedores recentes recuperada.');
  }
}

module.exports = new BattleRoyaleController();