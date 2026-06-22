/**
 * AnimesDTO - Responsável por transformar e formatar os dados do catálogo de animes.
 */
class AnimesDTO {
  /**
   * Transforma um registro de anime individual (formato de lista).
   * @param {Object} anime - Registro bruto do banco de dados.
   */
  static transform(anime) {
    if (!anime) return null;

    return {
      id: anime.id,
      malId: anime.mal_id,
      title: anime.title,
      titleEnglish: anime.title_english || anime.title,
      imageUrl: anime.image_url,
      type: anime.type,
      episodes: anime.episodes || 0,
      status: anime.status,
      score: anime.score ? parseFloat(anime.score) : 0,
      year: anime.year,
      genres: Array.isArray(anime.genres) ? anime.genres : JSON.parse(anime.genres || '[]'),
      updatedAt: anime.updated_at
    };
  }

  /**
   * Transforma uma lista de registros de animes.
   * @param {Array} animes 
   */
  static transformMany(animes) {
    if (!animes || !Array.isArray(animes)) return [];
    return animes.map(item => this.transform(item));
  }

  /**
   * Transforma os detalhes completos de um anime, incluindo personagens vinculados.
   * @param {Object} animeDetails 
   */
  static transformDetails(animeDetails) {
    if (!animeDetails) return null;

    const base = this.transform(animeDetails);

    return {
      ...base,
      synopsis: animeDetails.synopsis,
      characters: (animeDetails.characters || []).map(char => ({
        id: char.id,
        name: char.name,
        imageUrl: char.image_url,
        role: char.role
      }))
    };
  }

  /**
   * Formata os metadados de paginação.
   * @param {Object} pagination 
   */
  static transformPagination(pagination) {
    return {
      total: parseInt(pagination.total),
      page: parseInt(pagination.page),
      limit: parseInt(pagination.limit),
      totalPages: Math.ceil(pagination.total / pagination.limit)
    };
  }
}

module.exports = AnimesDTO;