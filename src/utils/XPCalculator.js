const { MATCH_REWARDS } = require('../core/constants/MatchTypes');

/**
 * XPCalculator - Centraliza a lógica de progressão e níveis do jogador.
 * A fórmula base é: Level = floor(sqrt(XP / 100)) + 1
 */
class XPCalculator {
  /**
   * Calcula o nível atual baseado no XP total.
   * @param {number} xp 
   * @returns {number}
   */
  static calculateLevel(xp) {
    if (!xp || xp <= 0) return 1;
    return Math.floor(Math.sqrt(xp / 100)) + 1;
  }

  /**
   * Calcula o XP total necessário para atingir um determinado nível.
   * @param {number} level 
   * @returns {number}
   */
  static getXPForLevel(level) {
    if (level <= 1) return 0;
    return Math.pow(level - 1, 2) * 100;
  }

  /**
   * Calcula o progresso atual do nível em porcentagem.
   * @param {number} xp 
   * @returns {Object} { currentLevel, nextLevelXP, progressPercentage }
   */
  static getProgress(xp) {
    const currentLevel = this.calculateLevel(xp);
    const currentLevelXP = this.getXPForLevel(currentLevel);
    const nextLevelXP = this.getXPForLevel(currentLevel + 1);
    
    const xpInCurrentLevel = xp - currentLevelXP;
    const xpRequiredForNextLevel = nextLevelXP - currentLevelXP;
    
    const progressPercentage = Math.min(
      Math.floor((xpInCurrentLevel / xpRequiredForNextLevel) * 100),
      100
    );

    return {
      currentLevel,
      xpInCurrentLevel,
      xpRequiredForNextLevel,
      progressPercentage,
      totalXP: xp
    };
  }

  /**
   * Calcula o XP ganho em uma partida.
   * @param {Object} params
   * @param {number} params.correctAnswers - Quantidade de acertos.
   * @param {number} params.totalQuestions - Total de questões da partida.
   * @param {string} params.matchType - Tipo da partida (1V1, BR, etc).
   * @param {boolean} params.isWinner - Se o jogador venceu a partida.
   * @param {number} params.avgResponseTime - Tempo médio de resposta em ms.
   */
  static calculateMatchXP({
    correctAnswers,
    totalQuestions,
    matchType,
    isWinner = false,
    avgResponseTime = 0
  }) {
    const BASE_XP_PER_CORRECT = 20;
    const WINNER_BONUS = 50;
    const SPEED_BONUS_THRESHOLD = 5000; // 5 segundos

    // 1. XP por acertos
    let earnedXP = correctAnswers * BASE_XP_PER_CORRECT;

    // 2. Bônus de Vitória
    if (isWinner) {
      earnedXP += WINNER_BONUS;
    }

    // 3. Bônus de Velocidade (se média for menor que 5s por questão)
    if (correctAnswers > 0 && avgResponseTime > 0 && avgResponseTime < SPEED_BONUS_THRESHOLD) {
      const speedMultiplier = 1 + (SPEED_BONUS_THRESHOLD - avgResponseTime) / SPEED_BONUS_THRESHOLD;
      earnedXP = Math.floor(earnedXP * speedMultiplier);
    }

    // 4. Aplicar multiplicador do Modo de Jogo
    const multiplier = MATCH_REWARDS[matchType]?.xp || 1.0;
    
    return Math.floor(earnedXP * multiplier);
  }
}

module.exports = XPCalculator;