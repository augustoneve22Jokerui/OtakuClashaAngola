/**
 * 🏆 OTAKU CLASH ANGOLA - TOURNAMENTS SERVICE
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Orquestrador de competições oficiais, inscrições e premiações.
 */

const BaseService = require('../../core/base/BaseService');
const tournamentsRepository = require('./tournaments.repository');
const walletsService = require('../wallets/wallets.service');
const notificationsService = require('../notifications/notifications.service');
const AppError = require('../../core/errors/AppError');
const logger = require('../../config/logger');

class TournamentsService extends BaseService {
  constructor() {
    super(tournamentsRepository);
  }

  /**
   * 📑 LISTAGEM DE TORNEIOS DISPONÍVEIS
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

      const total = await this.repository.count(status ? { status } : {});

      return {
        items,
        pagination: { total, page: parseInt(page), limit: parseInt(limit) }
      };
    } catch (error) {
      logger.error(`[TournamentsService:List] Erro: ${error.message}`);
      throw error;
    }
  }

  /**
   * ✍️ INSCRIÇÃO EM TORNEIO (PLAYER ACTION)
   * Valida requisitos, processa taxa e confirma a vaga de forma atômica.
   */
  async registerUser(tournamentId, userId) {
    return await this.executeInTransaction(async (client) => {
      // 1. Busca detalhes do torneio com trava de atualização
      const tournament = await this.repository.findDetailedById(tournamentId);
      
      if (!tournament) throw AppError.notFound('Torneio não localizado.');
      if (tournament.status !== 'REGISTRATION') {
        throw AppError.badRequest('As inscrições para este torneio não estão abertas.');
      }

      // 2. Validação de Vagas
      if (parseInt(tournament.currentParticipants) >= tournament.max_participants) {
        throw AppError.badRequest('Este torneio já atingiu o limite máximo de participantes.');
      }

      // 3. Verificação de Requisitos de Jogador
      const profilesRepository = require('../profiles/profiles.repository');
      const profile = await profilesRepository.findByUserId(userId);
      
      if (profile.level < (tournament.min_level || 1)) {
        throw AppError.forbidden(`Nível insuficiente. Este torneio exige nível ${tournament.min_level}.`);
      }

      // 4. Verifica se já está inscrito
      const alreadyIn = await this.repository.isUserRegistered(tournamentId, userId);
      if (alreadyIn) throw AppError.conflict('Você já está inscrito neste torneio.');

      // 5. Processamento Financeiro (Taxa de Inscrição)
      const entryFee = parseFloat(tournament.entry_fee || 0);
      if (entryFee > 0) {
        await walletsService.debit(
          userId,
          entryFee,
          'TOURNAMENT_ENTRY',
          `Inscrição no Torneio: ${tournament.name}`,
          { tournamentId: tournament.id },
          client
        );
      }

      // 6. Efetiva a Inscrição
      const participant = await this.repository.addParticipant(tournamentId, userId, client);

      // 7. Notificação de Confirmação (Background)
      notificationsService.notify({
        userId,
        title: '✅ Inscrição Confirmada',
        message: `Estás oficialmente inscrito no torneio ${tournament.name}. Prepara a tua estratégia!`,
        type: 'SYSTEM',
        metadata: { tournamentId: tournament.id }
      }).catch(err => logger.warn(`[Tournaments:Notify] Falha: ${err.message}`));

      logger.info(`[Tournaments:Join] Utilizador ${userId} inscrito no torneio ${tournament.name}`);
      return participant;
    });
  }

  /**
   * 🏃 CANCELAMENTO DE INSCRIÇÃO
   * Remove o jogador e estorna a taxa se o torneio ainda não iniciou.
   */
  async unregisterUser(tournamentId, userId) {
    const tournament = await this.repository.findById(tournamentId);
    if (!tournament) throw AppError.notFound('Torneio não encontrado.');

    if (tournament.status !== 'REGISTRATION') {
      throw AppError.badRequest('Não é possível cancelar a inscrição após o início ou encerramento do torneio.');
    }

    return await this.executeInTransaction(async (client) => {
      // 1. Remove do torneio
      const removed = await this.repository.removeParticipant(tournamentId, userId, client);
      if (!removed) throw AppError.badRequest('Inscrição não localizada para este utilizador.');

      // 2. Estorno da Taxa
      const entryFee = parseFloat(tournament.entry_fee || 0);
      if (entryFee > 0) {
        await walletsService.credit(
          userId,
          entryFee,
          'REFUND',
          `Reembolso de Inscrição: ${tournament.name}`,
          { tournamentId: tournament.id, type: 'CANCEL_REGISTRATION' },
          client
        );
      }

      logger.info(`[Tournaments:Leave] Utilizador ${userId} saiu do torneio ${tournament.id}`);
      return true;
    });
  }

  /**
   * 🔍 OBTÉM FICHA TÉCNICA DO TORNEIO
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
   * 🚦 ATUALIZA STATUS (STAFF ACTION)
   */
  async updateStatus(id, newStatus) {
    const validTransitions = {
      'REGISTRATION': ['IN_PROGRESS', 'CANCELLED'],
      'IN_PROGRESS': ['FINISHED', 'CANCELLED'],
      'FINISHED': [],
      'CANCELLED': []
    };

    const tournament = await this.repository.findById(id);
    if (!tournament) throw AppError.notFound('Torneio não localizado.');

    if (!validTransitions[tournament.status].includes(newStatus)) {
      throw AppError.badRequest(`Transição de estado inválida: de ${tournament.status} para ${newStatus}`);
    }

    const updated = await this.repository.updateStatus(id, newStatus);
    logger.info(`[Tournaments:Admin] Status do torneio ${id} alterado para ${newStatus}`);
    
    return updated;
  }
}

module.exports = new TournamentsService();