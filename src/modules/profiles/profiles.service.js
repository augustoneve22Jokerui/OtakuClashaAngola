/**
 * 👤 OTAKU CLASH ANGOLA - PROFILES SERVICE
 * Versão: 2.0.0 - Enterprise Grade
 * Descrição: Lógica de negócio para gestão de identidades, estatísticas e média de utilizadores.
 */

const BaseService = require('../../core/base/BaseService');
const profilesRepository = require('./profiles.repository');
const AppError = require('../../core/errors/AppError');
const logger = require('../../config/logger');
const uploadService = require('../../services/storage/UploadService');
const imageOptimizationService = require('../../services/storage/ImageOptimizationService');

class ProfilesService extends BaseService {
  constructor() {
    super(profilesRepository);
  }

  /**
   * 🏠 OBTÉM PERFIL COMPLETO (VISÃO PRIVADA)
   * Utilizado pelo próprio utilizador para ver seus dados e configurações.
   */
  async getMyProfile(userId) {
    const profile = await this.repository.findByUserId(userId);
    if (!profile) {
      throw AppError.notFound('Perfil de utilizador não encontrado no sistema.');
    }

    const stats = await this.repository.getProfileStats(userId);
    
    return {
      ...profile,
      statistics: stats
    };
  }

  /**
   * 🌍 OBTÉM PERFIL PÚBLICO
   * Suporta busca por UUID ou por Username.
   * @param {string} identifier - ID ou Nome de Utilizador.
   */
  async getPublicProfile(identifier) {
    let profile;
    
    // Verifica se o identificador é um UUID válido
    const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[4][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(identifier);

    if (isUUID) {
      profile = await this.repository.findByUserId(identifier);
    } else {
      profile = await this.repository.findOneByField('username', identifier);
    }

    if (!profile) {
      throw AppError.notFound('Utilizador não localizado.');
    }

    const stats = await this.repository.getProfileStats(profile.id);

    // Remove campos sensíveis para exibição pública
    const { email, updated_at, ...publicData } = profile;

    return {
      ...publicData,
      statistics: stats
    };
  }

  /**
   * ✍️ ATUALIZA DADOS DO PERFIL
   * Gerencia atualização de texto e processamento de imagem de avatar.
   */
  async updateProfile(userId, updateData, avatarFile = null) {
    return await this.executeInTransaction(async (client) => {
      
      // 1. Se houver tentativa de mudar username, verifica unicidade
      if (updateData.username) {
        const existing = await this.repository.findOneByField('username', updateData.username);
        if (existing && existing.id !== userId) {
          throw AppError.conflict('Este nome de utilizador já está em uso por outra conta.');
        }
      }

      // 2. Processamento de Novo Avatar
      if (avatarFile) {
        try {
          logger.debug(`[ProfilesService] Otimizando novo avatar para o utilizador: ${userId}`);
          
          // Otimiza para WebP, redimensiona e reduz peso
          const optimizedBuffer = await imageOptimizationService.optimizeAvatar(avatarFile.buffer);
          
          // Realiza o upload para o bucket 'avatars' no Supabase
          const uploadResult = await uploadService.uploadFile(
            { 
              buffer: optimizedBuffer, 
              mimetype: 'image/webp',
              originalname: `avatar_${userId}.webp`
            },
            'avatars',
            `users/${userId}`
          );

          updateData.avatar_url = uploadResult.url;
        } catch (error) {
          logger.error(`[ProfilesService:Avatar] Falha no processamento: ${error.message}`);
          throw AppError.unprocessable('Não foi possível processar a imagem do perfil. Tente outro formato.');
        }
      }

      // 3. Persiste as alterações no banco de dados
      const updatedProfile = await this.repository.updateProfileData(userId, updateData);
      
      logger.info(`[ProfilesService] Perfil do utilizador ${userId} atualizado com sucesso.`);
      return updatedProfile;
    });
  }

  /**
   * 🔎 BUSCA DE UTILIZADORES
   */
  async searchUsers(query, limit = 10) {
    if (!query || query.trim().length < 3) {
      throw AppError.badRequest('O termo de busca deve conter pelo menos 3 caracteres.');
    }

    try {
      const results = await this.repository.searchProfiles(query.trim(), limit);
      return results;
    } catch (error) {
      logger.error(`[ProfilesService:Search] Erro na busca: ${error.message}`);
      throw AppError.internal('Erro ao realizar busca de perfis.');
    }
  }

  /**
   * 🏅 ESTATÍSTICAS RÁPIDAS
   * Utilizado para matchmaking e cards resumidos.
   */
  async getQuickStats(userId) {
    const stats = await this.repository.getProfileStats(userId);
    return {
      level: stats.level,
      xp: stats.xp,
      winRate: stats.winRate,
      guild: stats.guildName
    };
  }
}

module.exports = new ProfilesService();