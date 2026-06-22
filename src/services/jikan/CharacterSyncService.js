const axios = require('axios');
const env = require('../../config/env');
const db = require('../../config/database');
const logger = require('../../config/logger');

/**
 * CharacterSyncService - Sincroniza personagens de animes específicos
 * utilizando a API Jikan.
 */
class CharacterSyncService {
  constructor() {
    this.baseUrl = env.JIKAN_API_URL;
    this.api = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
    });
  }

  /**
   * Aguarda um tempo determinado para respeitar o Rate Limit da Jikan.
   */
  async sleep(ms = 1000) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Sincroniza todos os personagens principais e secundários de um anime.
   * @param {number} malAnimeId - ID do Anime no MyAnimeList.
   * @param {number} localAnimeId - ID do Anime na nossa tabela local.
   */
  async syncCharactersByAnime(malAnimeId, localAnimeId) {
    try {
      logger.info(`[CharacterSync] Buscando personagens para o Anime MAL_ID: ${malAnimeId}`);
      
      const { data: { data: characters } } = await this.api.get(`/anime/${malAnimeId}/characters`);
      
      if (!characters || characters.length === 0) {
        logger.warn(`[CharacterSync] Nenhum personagem encontrado para o anime ${malAnimeId}`);
        return { processed: 0 };
      }

      let syncCount = 0;

      for (const charItem of characters) {
        const { character, role } = charItem;
        
        // Buscamos detalhes completos do personagem para obter a biografia (about)
        // Nota: Isso aumenta o número de requests, por isso o sleep é vital.
        await this.sleep(1200);
        await this.syncFullCharacterDetails(character.mal_id, localAnimeId, role);
        
        syncCount++;
      }

      logger.info(`[CharacterSync] Sincronização concluída. ${syncCount} personagens processados para o anime ${localAnimeId}.`);
      return { processed: syncCount };
    } catch (error) {
      logger.error(`[CharacterSync] Erro ao sincronizar personagens do anime ${malAnimeId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtém detalhes completos e realiza o upsert do personagem.
   */
  async syncFullCharacterDetails(malCharId, localAnimeId, role) {
    try {
      const { data: { data } } = await this.api.get(`/characters/${malCharId}/full`);

      const query = `
        INSERT INTO public.characters (
          mal_id, anime_id, name, about, image_url, role, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (mal_id) DO UPDATE SET
          anime_id = EXCLUDED.anime_id,
          name = EXCLUDED.name,
          about = EXCLUDED.about,
          image_url = EXCLUDED.image_url,
          role = EXCLUDED.role
        RETURNING id;
      `;

      const values = [
        data.mal_id,
        localAnimeId,
        data.name,
        data.about || '',
        data.images?.webp?.image_url || data.images?.jpg?.image_url,
        role || 'Supporting'
      ];

      const { rows } = await db.query(query, values);
      return rows[0];
    } catch (error) {
      logger.error(`[CharacterSync] Erro ao obter detalhes do personagem ${malCharId}: ${error.message}`);
      // Não lançamos o erro aqui para permitir que a sincronização dos outros personagens continue
      return null;
    }
  }

  /**
   * Método utilitário para sincronizar personagens de múltiplos animes pendentes.
   */
  async syncPendingAnimesCharacters() {
    try {
      // Busca animes que ainda não possuem personagens sincronizados (exemplo de lógica)
      const query = `
        SELECT a.id, a.mal_id 
        FROM public.animes a
        LEFT JOIN public.characters c ON a.id = c.anime_id
        WHERE c.id IS NULL
        LIMIT 5;
      `;
      
      const { rows: animes } = await db.query(query);

      for (const anime of animes) {
        await this.syncCharactersByAnime(anime.mal_id, anime.id);
        await this.sleep(2000);
      }
    } catch (error) {
      logger.error(`[CharacterSync] Erro na sincronização em lote: ${error.message}`);
    }
  }
}

module.exports = CharacterSyncService;