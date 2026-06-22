const BaseRepository = require('../../core/base/BaseRepository');

/**
 * MatchesRepository - Camada de acesso a dados para partidas e duelos.
 */
class MatchesRepository extends BaseRepository {
  constructor() {
    super('public.matches');
  }

  /**
   * Cria uma nova partida e retorna os dados da sala.
   */
  async createMatch(matchData) {
    const query = `
      INSERT INTO ${this.tableName} (
        type, room_code, entry_fee, prize_pool, max_players, status, anime_id, created_at
      )
      VALUES ($1, $2, $3, $4, $5, 'WAITING', $6, NOW())
      RETURNING *
    `;
    const values = [
      matchData.type,
      matchData.roomCode,
      matchData.entryFee || 0,
      matchData.prizePool || 0,
      matchData.maxPlayers || 2,
      matchData.animeId || null
    ];

    const { rows } = await this.db.query(query, values);
    return rows[0];
  }

  /**
   * Adiciona um jogador à partida.
   */
  async addPlayer(matchId, userId, client = null) {
    const query = `
      INSERT INTO public.match_players (match_id, user_id, joined_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (match_id, user_id) DO NOTHING
      RETURNING *
    `;
    const executor = client || this.db;
    const { rows } = await executor.query(query, [matchId, userId]);
    return rows[0];
  }

  /**
   * Atualiza o score de um jogador na partida.
   */
  async updatePlayerScore(matchId, userId, score, client = null) {
    const query = `
      UPDATE public.match_players
      SET score = $1
      WHERE match_id = $2 AND user_id = $3
      RETURNING *
    `;
    const executor = client || this.db;
    const { rows } = await executor.query(query, [score, matchId, userId]);
    return rows[0];
  }

  /**
   * Finaliza a partida definindo o status e o vencedor.
   */
  async finishMatch(matchId, winnerId, client = null) {
    const query = `
      UPDATE ${this.tableName}
      SET status = 'FINISHED',
          winner_id = $1,
          ended_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const executor = client || this.db;
    const { rows } = await executor.query(query, [winnerId, matchId]);
    return rows[0];
  }

  /**
   * Busca detalhes da partida incluindo os jogadores.
   */
  async findWithPlayers(matchId) {
    const query = `
      SELECT 
        m.*,
        json_agg(json_build_object(
          'id', p.id,
          'username', p.username,
          'avatarUrl', p.avatar_url,
          'score', mp.score,
          'position', mp.position
        )) as players
      FROM ${this.tableName} m
      JOIN public.match_players mp ON m.id = mp.match_id
      JOIN public.profiles p ON mp.user_id = p.id
      WHERE m.id = $1
      GROUP BY m.id
    `;
    const { rows } = await this.db.query(query, [matchId]);
    return rows[0] || null;
  }

  /**
   * Busca histórico de partidas de um usuário.
   */
  async findUserHistory(userId, limit = 10, offset = 0) {
    const query = `
      SELECT 
        m.*,
        mp.score as my_score,
        mp.reward_amount,
        (SELECT p.username FROM public.profiles p WHERE p.id = m.winner_id) as winner_username
      FROM ${this.tableName} m
      JOIN public.match_players mp ON m.id = mp.match_id
      WHERE mp.user_id = $1
      ORDER BY m.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const { rows } = await this.db.query(query, [userId, limit, offset]);
    return rows;
  }

  /**
   * Busca uma partida ativa pelo código da sala.
   */
  async findByRoomCode(roomCode) {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE room_code = $1 AND status = 'WAITING' 
      LIMIT 1
    `;
    const { rows } = await this.db.query(query, [roomCode.toUpperCase()]);
    return rows[0] || null;
  }

  /**
   * Verifica se o usuário já está em uma partida ativa.
   */
  async isUserInActiveMatch(userId) {
    const query = `
      SELECT m.id 
      FROM ${this.tableName} m
      JOIN public.match_players mp ON m.id = mp.match_id
      WHERE mp.user_id = $1 AND m.status IN ('WAITING', 'IN_PROGRESS')
      LIMIT 1
    `;
    const { rows } = await this.db.query(query, [userId]);
    return rows.length > 0;
  }
}

module.exports = new MatchesRepository();