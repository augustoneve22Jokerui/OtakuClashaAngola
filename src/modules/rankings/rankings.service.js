const BaseService = require('../../core/base/BaseService');
const AppError = require('../../core/errors/AppError');
const logger = require('../../config/logger');
const cacheProvider = require('../../config/cache');

/**
 * RankingsService - Gerencia o sistema de tiers competitivos e temporadas.
 * Diferente do Leaderboard (baseado em XP), o Rankings foca em divisões (Ouro, Platina, etc).
 */
class RankingsService extends BaseService {
  constructor() {
    // Nota: Como o módulo está sendo construído, assumiremos integração futura 
    // com um RankingsRepository ou uso direto do ProfilesRepository para colunas de LP.
    super(null); 
    
    // Definição de Tiers e Pontuações Mínimas
    this.TIERS = [
      { name: 'UNRANKED', minLP: 0, color: '#95a5a6' },
      { name: 'BRONZE', minLP: 100, color: '#cd7f32' },
      { name: 'PRATA', minLP: 500, color: '#c0c0c0' },
      { name: 'OURO', minLP: 1200, color: '#ffd700' },
      { name: 'PLATINA', minLP: 2500, color: '#e5e4e2' },
      { name: 'DIAMANTE', minLP: 5000, color: '#b9f2ff' },
      { name: 'MESTRE', minLP: 10000, color: '#9b59b6' },
      { name: 'LENDA', minLP: 25000, color: '#e74c3c' }
    ];
  }

  /**
   * Determina o Tier atual do usuário com base nos seus Pontos de Liga (LP).
   * @param {number} lp - League Points
   */
  getTierByLP(lp) {
    let currentTier = this.TIERS[0];
    for (const tier of this.TIERS) {
      if (lp >= tier.minLP) {
        currentTier = tier;
      } else {
        break;
      }
    }
    return currentTier;
  }

  /**
   * Obtém o perfil competitivo do usuário.
   */
  async getUserRankProfile(userId) {
    try {
      // Busca dados de LP do perfil do usuário
      const { rows } = await require('../../config/database').query(
        'SELECT lp, username, avatar_url FROM public.profiles WHERE id = $1',
        [userId]
      );

      if (rows.length === 0) throw AppError.notFound('Usuário não encontrado.');

      const user = rows[0];
      const lp = parseInt(user.lp || 0);
      const tier = this.getTierByLP(lp);
      
      // Busca posição no ranking de LP
      const posQuery = await require('../../config/database').query(
        'SELECT COUNT(*) + 1 as rank FROM public.profiles WHERE lp > $1',
        [lp]
      );

      return {
        userId,
        username: user.username,
        avatarUrl: user.avatar_url,
        lp,
        tier: tier.name,
        tierColor: tier.color,
        globalPosition: parseInt(posQuery.rows[0].rank),
        nextTier: this.TIERS[this.TIERS.indexOf(tier) + 1] || null
      };
    } catch (error) {
      logger.error(`[RankingsService] Erro ao obter perfil de rank: ${error.message}`);
      throw error;
    }
  }

  /**
   * Processa o ganho ou perda de LP após uma partida competitiva.
   * @param {string} userId 
   * @param {number} points - Pontos ganhos (positivo) ou perdidos (negativo)
   */
  async updateLeaguePoints(userId, points) {
    return await this.executeInTransaction(async (client) => {
      const { rows } = await client.query(
        'UPDATE public.profiles SET lp = GREATEST(0, lp + $1), updated_at = NOW() WHERE id = $2 RETURNING lp',
        [points, userId]
      );

      const newLP = rows[0].lp;
      const newTier = this.getTierByLP(newLP);

      logger.info(`[RankingsService] LP atualizado para usuário ${userId}: ${newLP} (${newTier.name})`);
      
      // Invalida cache de ranking se necessário
      await cacheProvider.delByPattern('rankings:*');

      return {
        userId,
        newLP,
        tier: newTier.name,
        pointsChanged: points
      };
    });
  }

  /**
   * Retorna os top jogadores da temporada atual baseados em LP.
   */
  async getTopPlayers(limit = 100) {
    const cacheKey = `rankings:top:${limit}`;
    const cached = await cacheProvider.get(cacheKey);
    if (cached) return cached;

    try {
      const { rows } = await require('../../config/database').query(
        `SELECT id, username, avatar_url, lp, level 
         FROM public.profiles 
         WHERE lp > 0 
         ORDER BY lp DESC 
         LIMIT $1`,
        [limit]
      );

      const result = rows.map((p, index) => ({
        position: index + 1,
        ...p,
        tier: this.getTierByLP(p.lp).name
      }));

      await cacheProvider.set(cacheKey, result, 300); // Cache de 5 minutos
      return result;
    } catch (error) {
      logger.error(`[RankingsService] Erro ao buscar top players: ${error.message}`);
      throw error;
    }
  }

  /**
   * Lógica de encerramento de temporada (Reset de LP e distribuição de recompensas).
   * Operação administrativa crítica.
   */
  async resetSeason() {
    logger.warn('[RankingsService] Iniciando reset de temporada competitiva!');
    
    try {
      // 1. Snapshot dos vencedores para histórico/recompensas (Opcional)
      // 2. Reset de LP (Ex: Reduz 50% do LP acima de Bronze ou reseta para base do Tier)
      await require('../../config/database').query(
        'UPDATE public.profiles SET lp = 0 WHERE lp IS NOT NULL'
      );

      await cacheProvider.delByPattern('rankings:*');
      logger.info('[RankingsService] Temporada resetada com sucesso.');
      return { success: true, message: 'Nova temporada iniciada.' };
    } catch (error) {
      logger.error(`[RankingsService] Falha crítica no reset de temporada: ${error.message}`);
      throw AppError.internal('Erro ao resetar temporada.');
    }
  }
}

module.exports = new RankingsService();