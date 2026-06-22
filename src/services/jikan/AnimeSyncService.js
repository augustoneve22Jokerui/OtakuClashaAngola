const axios = require('axios');
const env = require('../../config/env');
const db = require('../../config/database');
const logger = require('../../config/logger');

/**
 * AnimeSyncService - Responsável por sincronizar dados da API Jikan (MyAnimeList)
 * com o banco de dados local.
 */
class AnimeSyncService {
  constructor() {
    this.baseUrl = env.JIKAN_API_URL;
    this.api = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
    });
  }

  /**
   * Helper para respeitar o Rate Limit da Jikan (3 req/sec)
   */
  async sleep(ms = 1000) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Sincroniza um único anime pelo seu ID do MyAnimeList.
   * @param {number} malId 
   */
  async syncSingleAnime(malId) {
    try {
      logger.info(`[AnimeSync] Buscando dados para MAL_ID: ${malId}`);
      
      const { data: { data } } = await this.api.get(`/anime/${malId}/full`);
      
      if (!data) throw new Error('Anime não encontrado na API Jikan.');

      const result = await this.upsertAnime(data);
      
      logger.info(`[AnimeSync] Anime "${data.title}" sincronizado com sucesso.`);
      return result;
    } catch (error) {
      logger.error(`[AnimeSync] Erro ao sincronizar anime ${malId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sincroniza os animes mais populares da temporada atual.
   */
  async syncSeasonAnimes() {
    try {
      logger.info(`[AnimeSync] Iniciando sincronização da temporada atual.`);
      
      const { data: { data: seasonAnimes } } = await this.api.get('/seasons/now');

      for (const anime of seasonAnimes) {
        await this.upsertAnime(anime);
        // Delay para evitar 429 Too Many Requests
        await this.sleep(1200);
      }

      logger.info(`[AnimeSync] Sincronização de temporada finalizada. ${seasonAnimes.length} animes processados.`);
      return { processed: seasonAnimes.length };
    } catch (error) {
      logger.error(`[AnimeSync] Erro na sincronização de temporada: ${error.message}`);
      throw error;
    }
  }

  /**
   * Insere ou Atualiza o registro no banco de dados.
   * @param {Object} animeData - Dados brutos da Jikan
   */
  async upsertAnime(animeData) {
    const query = `
      INSERT INTO public.animes (
        mal_id, title, title_english, synopsis, image_url, 
        type, episodes, status, score, year, genres, updated_at
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      ON CONFLICT (mal_id) DO UPDATE SET
        title = EXCLUDED.title,
        title_english = EXCLUDED.title_english,
        synopsis = EXCLUDED.synopsis,
        image_url = EXCLUDED.image_url,
        type = EXCLUDED.type,
        episodes = EXCLUDED.episodes,
        status = EXCLUDED.status,
        score = EXCLUDED.score,
        year = EXCLUDED.year,
        genres = EXCLUDED.genres,
        updated_at = NOW()
      RETURNING id;
    `;

    const values = [
      animeData.mal_id,
      animeData.title,
      animeData.title_english,
      animeData.synopsis,
      animeData.images?.webp?.large_image_url || animeData.images?.jpg?.large_image_url,
      animeData.type,
      animeData.episodes,
      animeData.status,
      animeData.score,
      animeData.year || animeData.aired?.from?.split('-')[0] || null,
      JSON.stringify(animeData.genres?.map(g => g.name) || []),
    ];

    const { rows } = await db.query(query, values);
    return rows[0];
  }

  /**
   * Busca animes por nome na Jikan para importação manual.
   * @param {string} queryText 
   */
  async searchAndSync(queryText) {
    try {
      const { data: { data } } = await this.api.get('/anime', {
        params: { q: queryText, limit: 5 }
      });

      const syncResults = [];
      for (const item of data) {
        const synced = await this.upsertAnime(item);
        syncResults.push(synced);
        await this.sleep(500);
      }

      return syncResults;
    } catch (error) {
      logger.error(`[AnimeSync] Erro na busca e sincronização: ${error.message}`);
      throw error;
    }
  }
}

module.exports = AnimeSyncService;