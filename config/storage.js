const env = require('./env');

/**
 * Configuração Global de Storage (Supabase Buckets)
 * Define limites, permissões e nomes dos containers de arquivos.
 */
const storageConfig = {
  // Nomes dos Buckets extraídos do ambiente
  buckets: {
    avatars: env.STORAGE_BUCKET_AVATARS,
    animes: env.STORAGE_BUCKET_ANIMES,
    characters: env.STORAGE_BUCKET_CHARACTERS,
    quiz: env.STORAGE_BUCKET_QUIZ,
    tournaments: env.STORAGE_BUCKET_TOURNAMENTS,
  },

  // Limites globais de upload (em bytes)
  limits: {
    image: 5 * 1024 * 1024, // 5MB
    thumbnail: 1 * 1024 * 1024, // 1MB
  },

  // Tipos de arquivos permitidos (MIME Types)
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ],

  // Configurações de expiração para URLs assinadas (Signed URLs)
  urls: {
    signedExpiry: 60 * 60, // 1 hora em segundos
  },

  // Configuração de Otimização (Sharp)
  optimization: {
    avatar: {
      width: 250,
      height: 250,
      quality: 80,
    },
    banner: {
      width: 1200,
      height: 630,
      quality: 85,
    },
    quiz: {
      width: 800,
      height: 600,
      quality: 80,
    }
  }
};

/**
 * Helper para obter o bucket correto baseado no contexto
 * @param {string} type - O tipo de recurso (avatar, anime, etc)
 * @returns {string} O nome real do bucket no Supabase
 */
const getBucketName = (type) => {
  const bucket = storageConfig.buckets[type];
  if (!bucket) {
    throw new Error(`[StorageConfig] Bucket type "${type}" is not configured.`);
  }
  return bucket;
};

module.exports = {
  ...storageConfig,
  getBucketName
};