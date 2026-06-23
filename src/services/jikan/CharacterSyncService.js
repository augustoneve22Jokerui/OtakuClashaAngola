/**
 * 🛰️ OTAKU CLASH ANGOLA - CHARACTER SYNC SERVICE
 * Versão: 2.0.0 - Enterprise Resilient
 * Descrição: Sincroniza personagens de animes específicos com a Jikan API.
 */

const axios = require('axios');
const env = require('../../config/env');
const charactersRepository = require('../../modules/characters/characters.repository');
const logger = require('../../config/logger');

class CharacterSyncService {
  constructor() {
    this.baseUrl = env.JIKAN_API_URL || 'https://api.jikan.moe/v4';
    this.api = axios.create({
      baseURL: this.baseUrl,
      timeout: 15000,
    });
    
    // Rate limit delay (Jikan permite 3 req/sec)
    this.RATE_LIMIT_DELAY = 1200;
  }

  /**
   * ⏳ UTILIÁRIO DE ATRASO
   */
  async _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms || this.RATE_LIMIT_DELAY));
  }

  /**
   * 👥 SINCRONIZA TODOS OS PERSONAGENS DE UM ANIME
   * @param {number} malAnimeId - ID do MyAnimeList.
   * @param {number} localAnimeId - ID da nossa tabela 'animes'.
   */
  async syncCharactersByAnime(malAnimeId, localAnimeId) {
    try {
      logger.info(`[Sync:Chars] Capturando elenco para Anime MAL_ID: ${malAnimeId}`);
      
      const { data: { data: characters } } = await this.api.get(`/anime/${malAnimeId}/characters`);
      
      if (!characters || characters.length === 0) {
        logger.warn(`[Sync:Chars] Nenhum personagem localizado para o anime ${malAnimeId}`);
        return { processed: 0 };
      }

      let syncedCount = 0;
      // Sincronizamos os personagens um por um para buscar detalhes completos
      // Limitamos aos 15 primeiros para evitar overload e focar nos relevantes
      const topCharacters = characters.slice(0, 15);

      for (const charItem of topCharacters) {
        const { character, role } = charItem;
        
        // Respeita o Rate Limit antes de buscar detalhes individuais
        await this._sleep();
        
        await this._syncFullCharacterDetails(character.mal_id, localAnimeId, role);
        syncedCount++;
      }

      logger.info(`[Sync:Chars] Concluído. ${syncedCount} personagens integrados ao anime ${localAnimeId}.`);
      return { processed: syncedCount };

    } catch (error) {
      logger.error(`[Sync:Chars:Fail] Erro no anime ${malAnimeId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🔍 BUSCA DETALHES COMPLETOS E REALIZA UPSERT (PRIVATE)
   * Extrai a biografia (about) e imagens de alta qualidade.
   */
  async _syncFullCharacterDetails(malCharId, localAnimeId, role) {
    try {
      const { data: { data } } = await this.api.get(`/characters/${malCharId}/full`);

      const charData = {
        mal_id: data.mal_id,
        anime_id: localAnimeId,
        name: data.name,
        about: data.about || 'Sem informações disponíveis.',
        image_url: data.images?.webp?.image_url || data.images?.jpg?.image_url,
        role: role || 'Supporting',
        updated_at: new Date()
      };

      // Utiliza o repositório para evitar duplicatas por mal_id
      return await charactersRepository.syncUpsert(charData);

    } catch (error) {
      logger.error(`[Sync:Char:Details] Falha no personagem ${malCharId}: ${error.message}`);
      // Não interrompe o fluxo do anime se um personagem falhar
      return null;
    }
  }

  /**
   * ⚙️ SINCRONIZAÇÃO EM LOTE PARA ANIMES PENDENTES
   * Busca animes que ainda não possuem personagens mapeados.
   */
  async syncPendingAnimes() {
    const animesRepository = require('../../modules/animes/animes.repository');
    
    try {
      const query = `
        SELECT id, mal_id 
        FROM public.animes 
        WHERE id NOT IN (SELECT DISTINCT anime_id FROM public.characters)
        LIMIT 3
      `;
      
      const { rows: pendingAnimes } = await animesRepository.db.query(query);

      for (const anime of pendingAnimes) {
        await this.syncCharactersByAnime(anime.mal_id, anime.id);
        await this._sleep(2000); // Intervalo maior entre animes
      }
    } catch (error) {
      logger.error(`[Sync:Chars:Pending] Erro no processamento em lote: ${error.message}`);
    }
  }
}

module.exports = CharacterSyncService;