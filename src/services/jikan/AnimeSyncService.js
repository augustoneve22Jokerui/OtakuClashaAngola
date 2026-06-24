/**
 * 🔄 OTAKU CLASH ANGOLA - HYBRID ANIME SYNC SERVICE
 * Versão: 3.0.0 - Jikan + TMDB Resiliency & Search Extended
 * Descrição: Sincroniza dados do MyAnimeList (Jikan API V4) para o catálogo local com 
 *            respeito a Rate Limits e fallback resiliente automático via TMDB API.
 */

const axios = require('axios');
const env = require('../../config/env');
const animesRepository = require('../../modules/animes/animes.repository');
const logger = require('../../config/logger');

class AnimeSyncService {
  constructor() {
    // Cliente Principal: Jikan API V4
    this.jikan = axios.create({ 
      baseURL: env.JIKAN_API_URL || 'https://api.jikan.moe/v4', 
      timeout: 10000 
    });
    
    // Cliente de Fallback: TMDB (The Movie Database) com localização nativa pt-BR
    this.tmdb = axios.create({ 
      baseURL: env.TMDB_API_URL || 'https://api.themoviedb.org/3', 
      timeout: 10000,
      params: { 
        api_key: env.TMDB_API_KEY || 'ebc6c62b1d31f28ab2d155ad4c921657', 
        language: 'pt-BR' 
      }
    });

    // Jikan Free API possui limites de 3 req/sec e 60 req/min. Mantemos 1200ms de segurança.
    this.RATE_LIMIT_DELAY = 1200;
  }

  /**
   * ⏳ UTILIÁRIO DE ATRASO (ANTI RATE-LIMIT DRIVEN)
   */
  async _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms || this.RATE_LIMIT_DELAY));
  }

  /**
   * 🎬 SINCRONIZA UM ÚNICO ANIME (POR MAL_ID)
   * Realiza a tentativa primária via Jikan. Caso falte conectividade ou estoure o limite, migra para o TMDB.
   */
  async syncSingleAnime(malId) {
    try {
      logger.info(`[Sync:Anime] Tentando Jikan para MAL_ID: ${malId}`);
      
      const { data: { data } } = await this.jikan.get(`/anime/${malId}/full`);
      
      if (!data) throw new Error('Obra não localizada na API Jikan.');

      const result = await this._processAnimeUpsert(data);
      logger.info(`[Sync:Anime] Sincronização via Jikan concluída: "${data.title}"`);
      return result;
    } catch (error) {
      logger.warn(`[Sync:Anime] Jikan falhou (Status: ${error.response?.status || 'Timeout'}). Iniciando TMDB fallback...`);
      return await this._syncViaTMDBFallback(malId);
    }
  }

  /**
   * 🔄 FALLBACK: Busca metadados e capas no ecossistema TMDB
   */
  async _syncViaTMDBFallback(malId) {
    try {
      // Como a busca no TMDB requer texto, localiza o registro local preexistente para capturar o título
      const existing = await animesRepository.findByMalId(malId);
      if (!existing) {
        throw new Error('Não é possível usar o fallback do TMDB sem um título base já registrado no banco.');
      }

      logger.info(`[Sync:TMDB] Buscando alternativa no catálogo do TMDB para: "${existing.title}"`);
      const { data } = await this.tmdb.get('/search/tv', { params: { query: existing.title } });
      const result = data.results && data.results[0];

      if (!result) {
        throw new Error('Obra correlata não foi localizada também no repositório do TMDB.');
      }

      const updateData = {
        mal_id: malId,
        title: result.name || result.title || existing.title,
        title_english: existing.title_english || result.original_name || result.original_title,
        synopsis: result.overview || existing.synopsis,
        image_url: result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : existing.image_url,
        score: result.vote_average || existing.score,
        updated_at: new Date()
      };

      logger.info(`[Sync:TMDB:Success] Dados recuperados com sucesso via TMDB para o MAL_ID: ${malId}`);
      return await animesRepository.syncUpsert(updateData);
    } catch (err) {
      logger.error(`[Sync:TMDB:Fail] Fallback crítico falhou completamente: ${err.message}`);
      throw err;
    }
  }

  /**
   * 📅 SINCRONIZA ANIMES DA TEMPORADA ATUAL (CRON / DASHBOARD AUTOMATION)
   */
  async syncSeasonAnimes() {
    try {
      logger.info(`[Sync:Season] Iniciando captura da temporada actual via Jikan...`);
      
      const { data: { data: seasonAnimes } } = await this.jikan.get('/seasons/now');

      let syncedCount = 0;
      for (const anime of seasonAnimes) {
        await this._processAnimeUpsert(anime);
        syncedCount++;
        
        // Controle estrito de concorrência contra bloqueios de IP da Jikan
        await this._sleep();
      }

      logger.info(`[Sync:Season] Sucesso. ${syncedCount} obras atualizadas na temporada.`);
      return { processed: syncedCount };
    } catch (error) {
      logger.error(`[Sync:Season:Fail] Falha no ciclo de sincronização da temporada: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🔍 BUSCA E SINCRONIZA (IMPORTAÇÃO MANUAL VIA PAINEL ADMIN)
   */
  async searchAndSync(query) {
    try {
      logger.info(`[Sync:Search] Executando query de busca manual no catálogo Jikan: "${query}"`);
      const { data: { data } } = await this.jikan.get('/anime', {
        params: { q: query, limit: 5 }
      });

      const results = [];
      for (const item of data) {
        const synced = await this._processAnimeUpsert(item);
        results.push(synced);
        await this._sleep(500); // Delay menor reduzido especificamente para interações em tempo de execução humana
      }

      return results;
    } catch (error) {
      logger.error(`[Sync:Search] Erro na busca e extração de dados: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🛠️ MAPEIA, HIGIENIZA E PERSISTE NO REPOSITÓRIO (PRIVATE MAPPING ENGINE)
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

    // Redireciona para o repositório central executar o ON CONFLICT (mal_id) DO UPDATE
    return await animesRepository.syncUpsert(animeData);
  }
}

module.exports = AnimeSyncService;
