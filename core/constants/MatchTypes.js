/**
 * MatchTypes - Definição dos modos de jogo suportados pela plataforma.
 * Utilizado para roteamento de socket, matchmaking e regras de pontuação.
 */
const MatchTypes = {
  // Duelo direto 1 contra 1 com aposta de moedas ou ranking
  DUEL_1V1: '1V1_DUEL',

  // Modo multi-jogador massivo com rodadas eliminatórias
  BATTLE_ROYALE: 'BATTLE_ROYALE',

  // Partida competitiva dentro de uma estrutura de chaves de torneio
  TOURNAMENT: 'TOURNAMENT',

  // Desafio individual de resistência (acertar até errar)
  SURVIVAL: 'SURVIVAL',

  // Partida rápida casual sem impacto no ranking global
  QUICK_PLAY: 'QUICK_PLAY',

  // Modo de treino focado em animes específicos (sem custo de entrada)
  PRACTICE: 'PRACTICE',

  // Desafio contra o tempo com questões de alta velocidade
  BLITZ: 'BLITZ'
};

/**
 * Mapeamento de multiplicadores de recompensa por tipo de partida
 */
const MATCH_REWARDS = {
  [MatchTypes.DUEL_1V1]: { xp: 1.5, coins: 2.0 },
  [MatchTypes.BATTLE_ROYALE]: { xp: 3.0, coins: 5.0 },
  [MatchTypes.TOURNAMENT]: { xp: 5.0, coins: 10.0 },
  [MatchTypes.SURVIVAL]: { xp: 1.0, coins: 1.2 },
  [MatchTypes.QUICK_PLAY]: { xp: 0.5, coins: 0.5 },
  [MatchTypes.PRACTICE]: { xp: 0.1, coins: 0.0 },
  [MatchTypes.BLITZ]: { xp: 2.0, coins: 1.5 }
};

/**
 * Lista de todos os tipos para validação de esquemas
 */
const ALL_MATCH_TYPES = Object.values(MatchTypes);

module.exports = {
  MatchTypes: Object.freeze(MatchTypes),
  MATCH_REWARDS: Object.freeze(MATCH_REWARDS),
  ALL_MATCH_TYPES
};