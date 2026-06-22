const express = require('express');
const multer = require('multer');
const profilesController = require('./profiles.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const validationMiddleware = require('../../middlewares/validation.middleware');
const CommonSchema = require('../../validators/common.schema');
const { z } = require('zod');

// Configuração do Multer para processamento em memória (buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // Limite de 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas.'), false);
    }
  }
});

const router = express.Router();

/**
 * Todas as rotas de perfis exigem autenticação.
 */
router.use(authMiddleware);

/**
 * Obter dados do próprio perfil (Privado)
 * GET /api/v1/profiles/me
 */
router.get(
  '/me',
  profilesController.safe(profilesController.getMe)
);

/**
 * Obter estatísticas competitivas do próprio perfil
 * GET /api/v1/profiles/me/stats
 */
router.get(
  '/me/stats',
  profilesController.safe(profilesController.getMyStats)
);

/**
 * Atualizar dados do perfil e Avatar
 * PATCH /api/v1/profiles/me
 */
router.patch(
  '/me',
  upload.single('avatar'), // Intercepta o campo 'avatar' do formulário multipart
  validationMiddleware({
    body: z.object({
      username: z.string().min(3).max(30).optional(),
      full_name: z.string().min(2).max(100).optional()
    })
  }),
  profilesController.safe(profilesController.update)
);

/**
 * Buscar perfis por nome (Descoberta)
 * GET /api/v1/profiles/search
 */
router.get(
  '/search',
  validationMiddleware({
    query: z.object({
      q: z.string().min(3, 'Digite pelo menos 3 caracteres para buscar'),
      limit: z.coerce.number().int().min(1).max(50).default(10)
    })
  }),
  profilesController.safe(profilesController.search)
);

/**
 * Obter dados de um perfil público (por ID ou Username)
 * GET /api/v1/profiles/:identifier
 */
router.get(
  '/:identifier',
  validationMiddleware({
    params: z.object({
      identifier: z.string().min(1)
    })
  }),
  profilesController.safe(profilesController.getPublic)
);

module.exports = router;