/**
 * TournamentsDTO - Responsável pela transformação e formatação de dados de torneios.
 */
class TournamentsDTO {
  /**
   * Transforma os dados básicos de um torneio para listagem.
   * @param {Object} tournament - Registro bruto da tabela tournaments.
   */
  static transform(tournament) {
    if (!tournament) return null;

    return {
      id: tournament.id,
      name: tournament.name,
      description: tournament.description,
      status: tournament.status, // REGISTRATION, IN_PROGRESS, FINISHED, CANCELLED
      anime: {
        id: tournament.anime_id,
        title: tournament.anime_title || null
      },
      rules: {
        minLevel: parseInt(tournament.min_level || 1),
        maxParticipants: parseInt(tournament.max_participants || 0),
        currentParticipants: parseInt(tournament.current_participants || 0)
      },
      finance: {
        entryFee: parseFloat(tournament.entry_fee || 0).toFixed(2),
        prizePool: parseFloat(tournament.prize_pool || 0).toFixed(2),
        currency: 'AKZ'
      },
      schedule: {
        registrationOpens: tournament.registration_opens_at,
        startAt: tournament.start_at,
        endAt: tournament.end_at
      },
      bannerUrl: tournament.banner_url || null,
      createdAt: tournament.created_at
    };
  }

  /**
   * Transforma uma lista de torneios.
   * @param {Array} tournaments 
   */
  static transformMany(tournaments) {
    if (!tournaments || !Array.isArray(tournaments)) return [];
    return tournaments.map(t => this.transform(t));
  }

  /**
   * Transforma os detalhes completos de um torneio, incluindo participantes.
   * @param {Object} tournamentDetails 
   */
  static transformDetails(tournamentDetails) {
    if (!tournamentDetails) return null;

    const base = this.transform(tournamentDetails);

    return {
      ...base,
      anime: {
        ...base.anime,
        imageUrl: tournamentDetails.anime_image || null
      },
      participants: (tournamentDetails.participants || []).map(p => ({
        id: p.id,
        username: p.username,
        avatarUrl: p.avatar_url,
        level: parseInt(p.level || 1),
        joinedAt: p.joined_at
      }))
    };
  }

  /**
   * Transforma o histórico de participação de um usuário em torneios.
   * @param {Object} participation 
   */
  static transformUserParticipation(participation) {
    if (!participation) return null;

    return {
      tournamentId: participation.id,
      name: participation.name,
      status: participation.status,
      date: participation.start_at,
      myStatus: {
        joinedAt: participation.joined_at,
        position: participation.position || null,
        reward: participation.reward_amount ? parseFloat(participation.reward_amount).toFixed(2) : "0.00"
      }
    };
  }
}

module.exports = TournamentsDTO;