/**
 * BattleRoyaleDTO - Responsável pela transformação de dados do modo de jogo Battle Royale.
 */
class BattleRoyaleDTO {
  /**
   * Transforma os dados de uma sala de Battle Royale para listagem ou detalhes.
   * @param {Object} room - Dados brutos da tabela matches.
   */
  static transformRoom(room) {
    if (!room) return null;

    return {
      id: room.id,
      roomCode: room.room_code,
      title: room.title || `Batalha: ${room.anime_title || 'Geral'}`,
      status: room.status, // WAITING, IN_PROGRESS, FINISHED
      anime: {
        id: room.anime_id,
        title: room.anime_title || 'Todos os Animes'
      },
      settings: {
        entryFee: parseFloat(room.entry_fee || 0).toFixed(2),
        prizePool: parseFloat(room.prize_pool || 0).toFixed(2),
        currency: 'AKZ',
        maxPlayers: parseInt(room.max_players || 100),
        currentPlayers: parseInt(room.current_players || 0)
      },
      winner: room.winner_id ? {
        id: room.winner_id,
        username: room.winner_username,
        avatarUrl: room.winner_avatar
      } : null,
      timestamps: {
        createdAt: room.created_at,
        startedAt: room.started_at,
        endedAt: room.ended_at
      }
    };
  }

  /**
   * Transforma uma lista de salas.
   * @param {Array} rooms 
   */
  static transformManyRooms(rooms) {
    if (!rooms || !Array.isArray(rooms)) return [];
    return rooms.map(room => this.transformRoom(room));
  }

  /**
   * Transforma os dados de um jogador dentro de uma sessão de BR.
   * @param {Object} player - Dados do participante.
   */
  static transformPlayer(player) {
    if (!player) return null;

    return {
      id: player.user_id || player.id,
      username: player.username,
      avatarUrl: player.avatar_url,
      level: player.level,
      isEliminated: !!player.eliminated,
      score: parseInt(player.score || 0),
      position: player.position || null
    };
  }

  /**
   * Formata o resultado final de um vencedor para exibição em feed.
   * @param {Object} winnerData 
   */
  static transformWinner(winnerData) {
    return {
      username: winnerData.username,
      avatarUrl: winnerData.avatar_url,
      prize: parseFloat(winnerData.prize_pool || 0).toFixed(2),
      matchId: winnerData.match_id,
      date: winnerData.ended_at
    };
  }
}

module.exports = BattleRoyaleDTO;