/**
 * 🎮 OTAKU CLASH ANGOLA - MATCHES REPOSITORY
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Gestão de persistência para sessões de jogo, participantes e resultados.
 */

const BaseRepository = require('../../core/base/BaseRepository');
const logger = require('../../config/logger');

class MatchesRepository extends BaseRepository {
  constructor() {
    super('public.matches');
  }

  /**
   * 🏗️ INICIALIZA UMA PARTIDA ATOMICAMENTE
   */
  async createMatch(matchData, client = null) {
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

    try {
      const executor = client || this.db;
      const { rows } = await executor.query(query, values);
      return rows[0];
    } catch (error) {
      logger.error(`[MatchesRepo:Create] Falha: ${error.message}`);
      throw error;
    }
  }

  /**
   * 👥 ADICIONA JOGADOR À PARTIDA
   */
  async addPlayer(matchId, userId, client = null) {
    const query = `
      INSERT INTO public.match_players (match_id, user_id, joined_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (match_id, user_id) DO NOTHING
      RETURNING *
    `;
    
    try {
      const executor = client || this.db;
      const { rows } = await executor.query(query, [matchId, userId]);
      return rows[0];
    } catch (error) {
      logger.error(`[MatchesRepo:AddPlayer] Erro: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🔍 BUSCA DETALHES DA PARTIDA COM JOGADORES AGREGADOS
   */
  async findByIdWithPlayers(matchId) {
    const query = `
      SELECT 
        m.*,
        a.title as "animeTitle",
        (
          SELECT json_agg(json_build_object(
            'id', p.id,
            'username', p.username,
            'avatarUrl', p.avatar_url,
            'score', mp.score,
            'position', mp.position,
            'isWinner', (m.winner_id = p.id)
          ))
          FROM public.match_players mp
          JOIN public.profiles p ON mp.user_id = p.id
          WHERE mp.match_id = m.id
        ) as players
      FROM ${this.tableName} m
      LEFT JOIN public.animes a ON m.anime_id = a.id
      WHERE m.id = $1
      LIMIT 1
    `;

    try {
      const { rows } = await this.db.query(query, [matchId]);
      return rows[0] || null;
    } catch (error) {
      logger.error(`[MatchesRepo:Details] Erro: ${error.message}`);
      return null;
    }
  }

  /**
   * 🏆 FINALIZA PARTIDA E DEFINE VENCEDOR (LOCK)
   */
  async finishMatch(matchId, winnerId, client = null) {
    const query = `
      UPDATE ${this.tableName}
      SET 
        status = 'FINISHED',
        winner_id = $1,
        ended_at = NOW()
      WHERE id = $2 
      AND status != 'FINISHED'
      RETURNING *
    `;

    try {
      const executor = client || this.db;
      const { rows } = await executor.query(query, [winnerId, matchId]);
      return rows[0] || null;
    } catch (error) {
      logger.error(`[MatchesRepo:Finish] Erro: ${error.message}`);
      throw error;
    }
  }

  /**
   * 📑 HISTÓRICO DE PARTIDAS DO UTILIZADOR
   */
  async findUserHistory(userId, limit = 10, offset = 0) {
    const query = `
      SELECT 
        m.id,
        m.type,
        m.status,
        m.created_at as "date",
        m.prize_pool as "prizePool",
        mp.score as "myScore",
        mp.position as "myPosition",
        mp.reward_amount as "rewardAmount",
        (m.winner_id = $1) as "isVictory",
        a.title as "animeTitle"
      FROM public.matches m
      JOIN public.match_players mp ON m.id = mp.match_id
      LEFT JOIN public.animes a ON m.anime_id = a.id
      WHERE mp.user_id = $1
      ORDER BY m.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    try {
      const { rows } = await this.db.query(query, [userId, limit, offset]);
      return rows;
    } catch (error) {
      logger.error(`[MatchesRepo:History] Erro: ${error.message}`);
      return [];
    }
  }

  /**
   * 🚦 ATUALIZA SCORE PARCIAL DURANTE O JOGO
   */
  async updatePlayerScore(matchId, userId, score, client = null) {
    const query = `
      UPDATE public.match_players
      SET score = $1
      WHERE match_id = $2 AND user_id = $3
      RETURNING *
    `;
    
    try {
      const executor = client || this.db;
      const { rows } = await executor.query(query, [score, matchId, userId]);
      return rows[0];
    } catch (error) {
      return null;
    }
  }

  /**
   * 🕵️ MONITORIA: LISTA PARTIDAS EM ANDAMENTO
   */
  async findActiveMatches(limit = 20) {
    const query = `
      SELECT m.*, a.title as "animeTitle"
      FROM ${this.tableName} m
      LEFT JOIN public.animes a ON m.anime_id = a.id
      WHERE m.status = 'IN_PROGRESS'
      ORDER BY m.created_at DESC
      LIMIT $1
    `;
    try {
      const { rows } = await this.db.query(query, [limit]);
      return rows;
    } catch (error) {
      return [];
    }
  }
}

module.exports = new MatchesRepository();