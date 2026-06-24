/**
 * WalletsDTO - Responsável pela transformação e formatação de dados financeiros da carteira.
 */
class WalletsDTO {
  /**
   * Transforma um registro de carteira para resposta da API.
   * @param {Object} wallet - Registro bruto da tabela public.wallets.
   */
  static transform(wallet) {
    if (!wallet) return null;

    const available = parseFloat(wallet.balance_available || 0);
    const locked = parseFloat(wallet.balance_locked || 0);

    return {
      id: wallet.id,
      userId: wallet.user_id,
      balance: {
        available: available.toFixed(2),
        locked: locked.toFixed(2),
        total: (available + locked).toFixed(2),
        currency: wallet.currency || 'AKZ'
      },
      updatedAt: wallet.updated_at
    };
  }

  /**
   * Transforma uma lista de carteiras (uso administrativo).
   * @param {Array} wallets 
   */
  static transformMany(wallets) {
    if (!wallets || !Array.isArray(wallets)) return [];
    return wallets.map(wallet => this.transform(wallet));
  }

  /**
   * Formata uma resposta simplificada apenas com o saldo disponível.
   * @param {Object} wallet 
   */
  static transformSimpleBalance(wallet) {
    if (!wallet) return null;

    return {
      available: parseFloat(wallet.balance_available || 0).toFixed(2),
      currency: wallet.currency || 'AKZ'
    };
  }
}

module.exports = WalletsDTO;