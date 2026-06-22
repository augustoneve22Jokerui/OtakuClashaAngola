const BaseService = require('../../core/base/BaseService');
const profilesRepository = require('./profiles.repository');
const AppError = require('../../core/errors/AppError');
const logger = require('../../config/logger');
const uploadService = require('../../services/storage/UploadService');
const imageOptimizationService = require('../../services/storage/ImageOptimizationService');

/**
 * ProfilesService - Gerencia a lógica de negócio dos perfis e identidades sociais.
 */
class ProfilesService extends BaseService {
  constructor() {
    super(profilesRepository);
  }

  /**
   * Obtém os dados completos do perfil do próprio usuário autenticado.
   */
  async getMyProfile(userId) {
    const profile = await this.repository.findByUserId(userId);
    if (!profile) {
      throw AppError.notFound('Perfil de usuário não encontrado.');
    }

    const stats = await this.repository.getProfileStats(userId);
    return { ...profile, stats };
  }

  /**
   * Obtém a visão pública do perfil de outro usuário.
   */
  async getPublicProfile(userId) {
    const profile = await this.repository.findByUserId(userId);
    if (!profile) {
      throw AppError.notFound('Usuário não encontrado.');
    }

    const stats = await this.repository.getProfileStats(userId);
    
    // Remove dados sensíveis para exibição pública
    const { updated_at, ...publicData } = profile;
    
    return { ...publicData, stats };
  }

  /**
   * Atualiza as informações do perfil, incluindo processamento de imagem de avatar.
   */
  async updateProfile(userId, updateData, avatarFile = null) {
    return await this.executeInTransaction(async (client) => {
      // 1. Se houver mudança de username, verifica disponibilidade
      if (updateData.username) {
        const existing = await this.repository.findOneByField('username', updateData.username);
        if (existing && existing.id !== userId) {
          throw AppError.conflict('Este nome de usuário já está sendo utilizado.');
        }
      }

      // 2. Se houver upload de novo avatar
      if (avatarFile) {
        try {
          // Otimiza a imagem antes do upload (Redimensiona e converte para WebP)
          const optimizedBuffer = await imageOptimizationService.optimizeAvatar(avatarFile.buffer);
          
          const uploadResult = await uploadService.uploadFile(
            { ...avatarFile, buffer: optimizedBuffer },
            'avatars',
            `user_${userId}`
          );
          
          updateData.avatar_url = uploadResult.url;
        } catch (error) {
          logger.error(`[ProfilesService] Falha no processamento de avatar: ${error.message}`);
          throw AppError.unprocessable('Não foi possível processar a imagem do avatar.');
        }
      }

      // 3. Atualiza os dados no repositório
      const updatedProfile = await this.repository.updateProfile(userId, updateData);
      
      logger.info(`[ProfilesService] Perfil do usuário ${userId} atualizado com sucesso.`);
      return updatedProfile;
    });
  }

  /**
   * Busca perfis por termo de pesquisa.
   */
  async searchUsers(query) {
    if (!query || query.length < 3) {
      throw AppError.badRequest('O termo de busca deve ter pelo menos 3 caracteres.');
    }

    try {
      return await this.repository.searchProfiles(query);
    } catch (error) {
      logger.error(`[ProfilesService] Erro na busca de usuários: ${error.message}`);
      throw AppError.internal('Erro ao realizar busca de perfis.');
    }
  }

  /**
   * Obtém as estatísticas competitivas simplificadas para ranking/matchmaking.
   */
  async getQuickStats(userId) {
    const stats = await this.repository.getProfileStats(userId);
    return {
      level: stats.level,
      xp: stats.xp,
      winRate: stats.winRate
    };
  }
}

module.exports = new ProfilesService();