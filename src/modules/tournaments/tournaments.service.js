const BaseService = require('../../core/base/BaseService');
const tournamentsRepository = require('./tournaments.repository');
const AppError = require('../../core/errors/AppError');
const logger = require('../../config/logger');
const db = require('../../config/database');

/**
 * TournamentsService - Orquestra a lógica de competições oficiais e eventos sazonais.
 */
class TournamentsService extends BaseService {
  constructor() {
    super(tournamentsRepository);
  }

  /**
   * Lista torneios com base em filtros de atividade.
   */
  async listTournaments(filters) {
    try {
      const { status, animeId, page = 1, limit = 10 } = filters;
      const offset = (page - 1) * limit;

      const items = await this.repository.findActiveTournaments({
        status,
        animeId,
        limit,
        offset
      });

      return {
        items,
        pagination: {
          total: await this.repository.count(status ? { status } : {}),
          page,
          limit
        }
      };
    } catch (error) {
      logger.error(`[TournamentsService] Erro ao listar torneios: ${error.message}`);
      throw error;
    }
  }

  /**
   * Processa a inscrição de um usuário em um torneio.
   * Valida saldo, requisitos de nível e disponibilidade de vagas.
   */
  async registerUser(tournamentId, userId) {
    return await this.executeInTransaction(async (client) => {
      // 1. Busca detalhes do torneio com trava de atualização
      const { rows: [tournament] } = await client.query(
        'SELECT * FROM public.tournaments WHERE id = $1 FOR UPDATE',
        [tournamentId]
      );

      if (!tournament) throw AppError.notFound('Torneio não encontrado.');
      if (tournament.status !== 'REGISTRATION') {
        throw AppError.badRequest('Inscrições encerradas ou torneio já iniciado.');
      }

      // 2. Verifica se o usuário já está inscrito
      const isRegistered = await this.repository.isUserRegistered(tournamentId, userId);
      if (isRegistered) {
        throw AppError.conflict('Você já está inscrito neste torneio.');
      }

      // 3. Verifica limite de vagas
      const { rows: [{ count }] } = await client.query(
        'SELECT COUNT(*) as count FROM public.tournament_participants WHERE tournament_id = $1',
        [tournamentId]
      );

      if (parseInt(count) >= tournament.max_participants) {
        throw AppError.badRequest('Este torneio atingiu o limite máximo de participantes.');
      }

      // 4. Verifica Requisitos (Nível Mínimo)
      const { rows: [profile] } = await client.query(
        'SELECT level FROM public.profiles WHERE id = $1',
        [userId]
      );

      if (profile.level < (tournament.min_level || 1)) {
        throw AppError.forbidden(`Nível insuficiente. Nível mínimo exigido: ${tournament.min_level}`);
      }

      // 5. Processa Taxa de Inscrição (Entry Fee)
      if (parseFloat(tournament.entry_fee) > 0) {
        const { rows: [wallet] } = await client.query(
          'SELECT id, balance_available FROM public.wallets WHERE user_id = $1 FOR UPDATE',
          [userId]
        );

        if (!wallet || parseFloat(wallet.balance_available) < parseFloat(tournament.entry_fee)) {
          throw AppError.badRequest('Saldo insuficiente para a taxa de inscrição.');
        }

        // Deduz saldo da carteira
        await client.query(
          'UPDATE public.wallets SET balance_available = balance_available - $1 WHERE id = $2',
          [tournament.entry_fee, wallet.id]
        );

        // Registra transação
        await client.query(
          `INSERT INTO public.wallet_transactions (wallet_id, amount, direction, type, status, description)
           VALUES ($1, $2, 'DEBIT', 'TOURNAMENT_ENTRY', 'COMPLETED', $3)`,
          [wallet.id, tournament.entry_fee, `Inscrição no torneio: ${tournament.name}`]
        );
      }

      // 6. Finaliza a inscrição
      const participant = await this.repository.addParticipant(tournamentId, userId, client);

      logger.info(`[TournamentsService] Usuário ${userId} inscrito no torneio ${tournamentId}`);
      return participant;
    });
  }

  /**
   * Cancela a inscrição de um usuário (apenas se em fase de REGISTRATION).
   */
  async unregisterUser(tournamentId, userId) {
    const tournament = await this.repository.findById(tournamentId);
    if (!tournament || tournament.status !== 'REGISTRATION') {
      throw AppError.badRequest('Não é possível cancelar a inscrição agora.');
    }

    return await this.executeInTransaction(async (client) => {
      const removed = await this.repository.removeParticipant(tournamentId, userId, client);
      if (!removed) throw AppError.badRequest('Inscrição não localizada.');

      // Estorno da taxa se aplicável
      if (parseFloat(tournament.entry_fee) > 0) {
        await client.query(
          `UPDATE public.wallets SET balance_available = balance_available + $1 
           WHERE user_id = $2`,
          [tournament.entry_fee, userId]
        );
        
        // Registrar transação de estorno
        await client.query(
          `INSERT INTO public.wallet_transactions (wallet_id, amount, direction, type, status, description)
           SELECT id, $1, 'CREDIT', 'REFUND', 'COMPLETED', $2
           FROM public.wallets WHERE user_id = $3`,
          [tournament.entry_fee, `Reembolso de inscrição: ${tournament.name}`, userId]
        );
      }

      return true;
    });
  }

  /**
   * Obtém detalhes completos para a página do torneio.
   */
  async getTournamentDetails(id) {
    const tournament = await this.repository.findDetailedById(id);
    if (!tournament) throw AppError.notFound('Torneio não encontrado.');

    const participants = await this.repository.getParticipants(id);

    return {
      ...tournament,
      participants
    };
  }

  /**
   * Operação Admin: Altera o estado do torneio (ex: Iniciar Competição).
   */
  async updateStatus(tournamentId, status) {
    const validTransitions = {
      'REGISTRATION': ['IN_PROGRESS', 'CANCELLED'],
      'IN_PROGRESS': ['FINISHED', 'CANCELLED'],
      'FINISHED': [],
      'CANCELLED': []
    };

    const tournament = await this.repository.findById(tournamentId);
    if (!tournament) throw AppError.notFound('Torneio inexistente.');

    if (!validTransitions[tournament.status].includes(status)) {
      throw AppError.badRequest(`Transição de estado inválida de ${tournament.status} para ${status}`);
    }

    return await this.repository.updateStatus(tournamentId, status);
  }
}

module.exports = new TournamentsService();