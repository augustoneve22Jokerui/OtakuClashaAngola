const BaseRepository = require('../../core/base/BaseRepository');

/**
 * RankingsRepository - Camada de acesso a dados para o sistema de classificação competitiva.
 * Atua principalmente sobre a tabela profiles para gerenciar LP (League Points).
 */
class RankingsRepository extends BaseRepository {
  constructor() {
    super('public.profiles');
  }

  /**
   * Busca os usuários com maior Pontuação de Liga (LP).
   * @param {number} limit - Quantidade de registros.
   * @param {number} offset - Deslocamento para paginação.
   */
  async getTopPlayersByLP(limit = 100, offset = 0) {
    const query = `
      SELECT 
        id, 
        username, 
        avatar_url, 
        lp, 
        level,
        RANK() OVER (ORDER BY lp DESC) as rank_position
      FROM ${this.tableName}
      WHERE lp > 0
      ORDER BY lp DESC
      LIMIT $1 OFFSET $2
    `;
    const { rows } = await this.db.query(query, [limit, offset]);
    return rows;
  }

  /**
   * Obtém a posição exata de um usuário no ranking de LP.
   * @param {number} lp - Os pontos de liga do usuário atual.
   */
  async getPositionByLP(lp) {
    const query = `
      SELECT COUNT(*) + 1 as position 
      FROM ${this.tableName} 
      WHERE lp > $1
    `;
    const { rows } = await this.db.query(query, [lp]);
    return parseInt(rows[0].position, 10);
  }

  /**
   * Atualiza os pontos de liga (LP) do usuário.
   * Garante que o valor nunca seja inferior a zero.
   * @param {string} userId - UUID do usuário.
   * @param {number} points - Pontos a adicionar ou subtrair.
   * @param {Object} client - Cliente de transação opcional.
   */
  async updateLP(userId, points, client = null) {
    const executor = client || this.db;
    const query = `
      UPDATE ${this.tableName}
      SET lp = GREATEST(0, lp + $1),
          updated_at = NOW()
      WHERE id = $2
      RETURNING lp, username, avatar_url
    `;
    const { rows } = await executor.query(query, [points, userId]);
    return rows[0];
  }

  /**
   * Obtém estatísticas de distribuição de jogadores por faixa de LP (para análise de Tiers).
   */
  async getTierDistribution() {
    const query = `
      SELECT 
        CASE 
          WHEN lp >= 25000 THEN 'LENDA'
          WHEN lp >= 10000 THEN 'MESTRE'
          WHEN lp >= 5000 THEN 'DIAMANTE'
          WHEN lp >= 2500 THEN 'PLATINA'
          WHEN lp >= 1200 THEN 'OURO'
          WHEN lp >= 500 THEN 'PRATA'
          WHEN lp >= 100 THEN 'BRONZE'
          ELSE 'UNRANKED'
        END as tier,
        COUNT(*) as player_count
      FROM ${this.tableName}
      GROUP BY tier
      ORDER BY player_count DESC
    `;
    const { rows } = await this.db.query(query);
    return rows;
  }

  /**
   * Reseta o progresso competitivo de todos os usuários (Reset de Temporada).
   * @param {Object} client - Cliente de transação obrigatório para segurança.
   */
  async resetAllLP(client) {
    const query = `UPDATE ${this.tableName} SET lp = 0 WHERE lp > 0`;
    return await client.query(query);
  }
}

module.exports = new RankingsRepository();