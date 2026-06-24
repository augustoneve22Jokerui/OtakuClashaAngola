/**
 * 🛣️ OTAKU CLASH ANGOLA - PROFILES ROUTES
 * Versão: 2.0.0 - Enterprise Secured
 * Descrição: Endpoints para gestão de perfis, busca de utilizadores e upload de média.
 */

const express = require('express');
const multer = require('multer');
const profilesController = require('./profiles.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const validationMiddleware = require('../../middlewares/validation.middleware');
const CommonSchema = require('../../validators/common.schema');
const { z } = require('zod');

const router = express.Router();

/**
 * 📸 CONFIGURAÇÃO DE UPLOAD (TEMPORÁRIO EM MEMÓRIA)
 * A imagem é mantida no buffer para processamento pelo ImageOptimizationService.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // Limite de 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas ficheiros de imagem são permitidos.'), false);
    }
  }
});

/**
 * 🔒 PROTEÇÃO DE SESSÃO
 * Todas as rotas sociais exigem utilizador autenticado.
 */
router.use(authMiddleware);

/**
 * ==================================================
 * ROTAS PRIVADAS (PRÓPRIO PERFIL)
 * ==================================================
 */

/**
 * 🏠 OBTER MEU PERFIL
 * GET /api/v1/profiles/me
 */
router.get(
  '/me',
  profilesController.safe(profilesController.getMe)
);

/**
 * 📊 MINHAS ESTATÍSTICAS DE JOGO
 * GET /api/v1/profiles/me/stats
 */
router.get(
  '/me/stats',
  profilesController.safe(profilesController.getMyStats)
);

/**
 * ✍️ ATUALIZAR MEU PERFIL E AVATAR
 * PATCH /api/v1/profiles/me
 */
router.patch(
  '/me',
  upload.single('avatar'), // Intercepta o campo 'avatar' do multipart/form-data
  validationMiddleware({
    body: z.object({
      username: z.string().min(3).max(30).optional(),
      full_name: z.string().min(2).max(100).optional()
    })
  }),
  profilesController.safe(profilesController.update)
);

/**
 * ==================================================
 * ROTAS PÚBLICAS / DESCOBERTA
 * ==================================================
 */

/**
 * 🔎 BUSCAR UTILIZADORES
 * GET /api/v1/profiles/search
 */
router.get(
  '/search',
  validationMiddleware({
    query: z.object({
      q: z.string().min(3, 'O termo de busca deve ter pelo menos 3 caracteres'),
      limit: z.coerce.number().int().min(1).max(50).default(10)
    })
  }),
  profilesController.safe(profilesController.search)
);

/**
 * 🌍 CONSULTAR PERFIL PÚBLICO
 * GET /api/v1/profiles/:identifier
 * @param {string} identifier - Pode ser UUID ou Username
 */
router.get(
  '/:identifier',
  validationMiddleware({
    params: z.object({
      identifier: z.string().min(1, 'Identificador é obrigatório')
    })
  }),
  profilesController.safe(profilesController.getPublic)
);

module.exports = router;