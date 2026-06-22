/**
 * CharactersDTO - Responsável pela transformação e formatação dos dados de personagens.
 */
class CharactersDTO {
  /**
   * Transforma um registro de personagem individual (formato de lista).
   * @param {Object} character - Registro bruto do banco de dados.
   */
  static transform(character) {
    if (!character) return null;

    return {
      id: character.id,
      malId: character.mal_id,
      animeId: character.anime_id,
      name: character.name,
      imageUrl: character.image_url,
      role: character.role || 'Supporting',
      animeTitle: character.anime_title || null, // Preenchido se houver JOIN na query
      createdAt: character.created_at
    };
  }

  /**
   * Transforma uma lista de personagens.
   * @param {Array} characters 
   */
  static transformMany(characters) {
    if (!characters || !Array.isArray(characters)) return [];
    return characters.map(item => this.transform(item));
  }

  /**
   * Transforma os detalhes completos de um personagem.
   * @param {Object} details - Objeto contendo dados do personagem e do anime vinculado.
   */
  static transformDetails(details) {
    if (!details) return null;

    const base = this.transform(details);

    return {
      ...base,
      about: details.about || 'Nenhuma informação disponível.',
      anime: details.anime ? {
        id: details.anime.id,
        title: details.anime.title,
        imageUrl: details.anime.image_url
      } : null
    };
  }
}

module.exports = CharactersDTO;