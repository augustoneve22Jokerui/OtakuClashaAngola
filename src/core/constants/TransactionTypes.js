/**
 * TransactionTypes - Definição de todos os tipos de movimentação financeira.
 * Essencial para o módulo de Wallet e integridade do histórico de transações.
 */
const TransactionTypes = {
  // ENTRADAS (CRÉDITO)
  DEPOSIT: 'DEPOSIT',               // Depósito via gateway (MCX, etc)
  MATCH_REWARD: 'MATCH_REWARD',     // Prêmio por vitória em partida
  TOURNAMENT_PRIZE: 'TOURNAMENT_PRIZE', // Prêmio de grande torneio
  REFERRAL_BONUS: 'REFERRAL_BONUS', // Bônus por convite de novos usuários
  ACHIEVEMENT_REWARD: 'ACHIEVEMENT_REWARD', // Recompensa por conquista
  ADMIN_CREDIT: 'ADMIN_CREDIT',     // Ajuste manual positivo por admin
  REFUND: 'REFUND',                 // Estorno de entrada em partida ou erro

  // SAÍDAS (DÉBITO)
  WITHDRAWAL: 'WITHDRAWAL',         // Saque para conta bancária/móvel
  MATCH_ENTRY: 'MATCH_ENTRY',       // Custo de entrada em partida apostada
  TOURNAMENT_ENTRY: 'TOURNAMENT_ENTRY', // Custo de inscrição em torneio
  STORE_PURCHASE: 'STORE_PURCHASE', // Compra de itens cosméticos ou buffs
  GUILD_CREATION: 'GUILD_CREATION', // Custo para criar um clã
  ADMIN_DEBIT: 'ADMIN_DEBIT'        // Ajuste manual negativo por admin
};

/**
 * Categorização para lógica de balanço (Soma ou Subtração)
 */
const TransactionDirections = {
  [TransactionTypes.DEPOSIT]: 'CREDIT',
  [TransactionTypes.MATCH_REWARD]: 'CREDIT',
  [TransactionTypes.TOURNAMENT_PRIZE]: 'CREDIT',
  [TransactionTypes.REFERRAL_BONUS]: 'CREDIT',
  [TransactionTypes.ACHIEVEMENT_REWARD]: 'CREDIT',
  [TransactionTypes.ADMIN_CREDIT]: 'CREDIT',
  [TransactionTypes.REFUND]: 'CREDIT',
  
  [TransactionTypes.WITHDRAWAL]: 'DEBIT',
  [TransactionTypes.MATCH_ENTRY]: 'DEBIT',
  [TransactionTypes.TOURNAMENT_ENTRY]: 'DEBIT',
  [TransactionTypes.STORE_PURCHASE]: 'DEBIT',
  [TransactionTypes.GUILD_CREATION]: 'DEBIT',
  [TransactionTypes.ADMIN_DEBIT]: 'DEBIT'
};

/**
 * Status possíveis para uma transação
 */
const TransactionStatus = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED'
};

const ALL_TRANSACTION_TYPES = Object.values(TransactionTypes);

module.exports = {
  TransactionTypes: Object.freeze(TransactionTypes),
  TransactionDirections: Object.freeze(TransactionDirections),
  TransactionStatus: Object.freeze(TransactionStatus),
  ALL_TRANSACTION_TYPES
};