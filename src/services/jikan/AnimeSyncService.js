/**
 * 🛰️ OTAKU CLASH ANGOLA - ANIME SYNC SERVICE (JIKAN API V4)
 * Versão: 2.0.0 - Enterprise Resilient
 * Descrição: Sincroniza dados do MyAnimeList para o catálogo local com respeito a Rate Limits.
 */

const axios = require('axios');
const env = require('../../config/env');
const animesRepository = require('../../modules/animes/animes.repository');
const logger = require('../../config/logger');

class AnimeSyncService {
  constructor() {
    this.baseUrl = env.JIKAN_API_URL || 'https://api.jikan.moe/v4';
    this.api = axios.create({
      baseURL: this.baseUrl,
      timeout: 15000,
    });
    
    // Jikan Free API tem limite de 3 req/sec e 60 req/min
    this.RATE_LIMIT_DELAY = 1200; 
  }

  /**
   * ⏳ UTILIÁRIO DE ATRASO
   */
  async _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms || this.RATE_LIMIT_DELAY));
  }

  /**
   * 🎬 SINCRONIZA UM ÚNICO ANIME (POR MAL_ID)
   */
  async syncSingleAnime(malId) {
    try {
      logger.info(`[Sync:Anime] Buscando metadados para MAL_ID: ${malId}`);
      
      const { data: { data } } = await this.api.get(`/anime/${malId}/full`);
      
      if (!data) throw new Error('Obra não localizada na API Jikan.');

      const result = await this._processAnimeUpsert(data);
      
      logger.info(`[Sync:Anime] Sincronização concluída: "${data.title}"`);
      return result;
    } catch (error) {
      logger.error(`[Sync:Anime:Fail] Erro ao sincronizar ID ${malId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * 📅 SINCRONIZA ANIMES DA TEMPORADA ATUAL
   * Ideal para manter o catálogo atualizado com lançamentos.
   */
  async syncSeasonAnimes() {
    try {
      logger.info(`[Sync:Season] Iniciando captura da temporada actual...`);
      
      const { data: { data: seasonAnimes } } = await this.api.get('/seasons/now');

      let syncedCount = 0;
      for (const anime of seasonAnimes) {
        await this._processAnimeUpsert(anime);
        syncedCount++;
        
        // Respeita o Rate Limit da Jikan
        await this._sleep();
      }

      logger.info(`[Sync:Season] Sucesso. ${syncedCount} obras integradas ao catálogo.`);
      return { processed: syncedCount };
    } catch (error) {
      logger.error(`[Sync:Season:Fail] Erro: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🔍 BUSCA E SINCRONIZA (IMPORTAÇÃO MANUAL)
   */
  async searchAndSync(query) {
    try {
      const { data: { data } } = await this.api.get('/anime', {
        params: { q: query, limit: 5 }
      });

      const results = [];
      for (const item of data) {
        const synced = await this._processAnimeUpsert(item);
        results.push(synced);
        await this._sleep(500);
      }

      return results;
    } catch (error) {
      logger.error(`[Sync:Search] Erro na busca: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🛠️ MAPEIA E PERSISTE NO BANCO (PRIVATE)
   */
  async _processAnimeUpsert(raw) {
    const animeData = {
      mal_id: raw.mal_id,
      title: raw.title,
      title_english: raw.title_english || raw.title,
      synopsis: raw.synopsis,
      image_url: raw.images?.webp?.large_image_url || raw.images?.jpg?.large_image_url,
      type: raw.type,
      episodes: raw.episodes || 0,
      status: raw.status,
      score: raw.score || 0,
      year: raw.year || (raw.aired?.from ? new Date(raw.aired.from).getFullYear() : null),
      genres: JSON.stringify(raw.genres?.map(g => g.name) || []),
      updated_at: new Date()
    };

    // Utiliza o método syncUpsert do repositório para evitar duplicatas por mal_id
    return await animesRepository.syncUpsert(animeData);
  }
}

module.exports = AnimeSyncService;