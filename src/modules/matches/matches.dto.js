/**
 * MatchesDTO - Responsável pela formatação de dados de partidas e histórico.
 */
class MatchesDTO {
  /**
   * Transforma os dados básicos de uma partida.
   * @param {Object} match - Registro bruto da tabela matches.
   */
  static transform(match) {
    if (!match) return null;

    return {
      id: match.id,
      type: match.type,
      roomCode: match.room_code,
      status: match.status,
      entryFee: parseFloat(match.entry_fee || 0).toFixed(2),
      prizePool: parseFloat(match.prize_pool || 0).toFixed(2),
      currency: 'AKZ',
      animeId: match.anime_id,
      winnerId: match.winner_id,
      winnerUsername: match.winner_username || null,
      createdAt: match.created_at,
      startedAt: match.started_at,
      endedAt: match.ended_at
    };
  }

  /**
   * Transforma detalhes de uma partida incluindo jogadores e suas pontuações.
   * @param {Object} matchDetails - Dados da partida com array de jogadores.
   */
  static transformDetails(matchDetails) {
    if (!matchDetails) return null;

    const base = this.transform(matchDetails);

    return {
      ...base,
      players: (matchDetails.players || []).map(player => ({
        id: player.id,
        username: player.username,
        avatarUrl: player.avatarUrl,
        score: parseInt(player.score || 0),
        position: player.position || null,
        isWinner: player.id === matchDetails.winner_id
      }))
    };
  }

  /**
   * Transforma o histórico de partidas do usuário.
   * @param {Object} item - Item da query de histórico.
   */
  static transformHistoryItem(item) {
    return {
      matchId: item.id,
      type: item.type,
      status: item.status,
      date: item.created_at,
      myScore: parseInt(item.my_score || 0),
      reward: parseFloat(item.reward_amount || 0).toFixed(2),
      winner: item.winner_username || 'Empate/Indefinido',
      isVictory: item.winner_id === item.user_id // Comparação baseada no contexto da query
    };
  }

  /**
   * Transforma uma lista de histórico.
   * @param {Array} history 
   */
  static transformHistory(history) {
    if (!history || !Array.isArray(history)) return [];
    return history.map(item => this.transformHistoryItem(item));
  }
}

module.exports = MatchesDTO;