/**
 * 🛣️ OTAKU CLASH ANGOLA - CHARACTERS ROUTES
 * Versão: 2.0.0 - Enterprise Secured
 * Descrição: Endpoints para gestão de personagens, suporte ao Quiz e curadoria.
 */

const express = require('express');
const multer = require('multer');
const charactersController = require('./characters.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');
const validationMiddleware = require('../../middlewares/validation.middleware');
const { Roles } = require('../../core/constants/Roles');
const CommonSchema = require('../../validators/common.schema');
const { z } = require('zod');

const router = express.Router();

/**
 * 📸 CONFIGURAÇÃO DE UPLOAD (MEMÓRIA)
 * Permite que o Service otimize a imagem antes de persistir no Supabase Storage.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // Limite de 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Formato de ficheiro inválido. Envie apenas imagens.'), false);
    }
  }
});

/**
 * 🔒 PROTEÇÃO DE SESSÃO
 * Todas as rotas de personagens exigem utilizador autenticado.
 */
router.use(authMiddleware);

/**
 * ==================================================
 * ROTAS PÚBLICAS (PLAYER / ADMIN)
 * ==================================================
 */

/**
 * 📑 LISTAGEM DE PERSONAGENS
 * GET /api/v1/characters
 */
router.get(
  '/',
  validationMiddleware({
    query: CommonSchema.pagination.extend({
      search: z.string().optional(),
      animeId: z.coerce.number().int().optional()
    })
  }),
  charactersController.safe(charactersController.list)
);

/**
 * 🎲 PERSONAGENS ALEATÓRIOS (MOTOR DE QUIZ)
 * GET /api/v1/characters/random
 */
router.get(
  '/random',
  validationMiddleware({
    query: z.object({
      limit: z.coerce.number().int().min(1).max(20).default(4),
      excludeId: z.string().optional()
    })
  }),
  charactersController.safe(charactersController.getRandom)
);

/**
 * 🎬 PERSONAGENS POR ANIME
 * GET /api/v1/characters/anime/:animeId
 */
router.get(
  '/anime/:animeId',
  validationMiddleware({
    params: z.object({ animeId: CommonSchema.numericId })
  }),
  charactersController.safe(charactersController.getByAnime)
);

/**
 * 🔍 DETALHES DE UM PERSONAGEM
 * GET /api/v1/characters/:id
 */
router.get(
  '/:id',
  validationMiddleware({
    params: z.object({ id: CommonSchema.numericId })
  }),
  charactersController.safe(charactersController.getDetails)
);

/**
 * ==================================================
 * ROTAS ADMINISTRATIVAS (STAFF ONLY)
 * ==================================================
 */

/**
 * 📊 MÉTRICAS DO MÓDULO (ADMIN DASHBOARD)
 * GET /api/v1/characters/admin/stats
 */
router.get(
  '/admin/stats',
  roleMiddleware(Roles.ADMIN, Roles.MODERADOR),
  charactersController.safe(charactersController.getStats)
);

/**
 * ✨ CRIAR NOVO PERSONAGEM
 * POST /api/v1/characters
 */
router.post(
  '/',
  roleMiddleware(Roles.ADMIN, Roles.MODERADOR),
  upload.single('image'),
  validationMiddleware({
    body: z.object({
      name: z.string().min(2).max(100),
      anime_id: z.coerce.number().int().positive(),
      mal_id: z.coerce.number().int().positive().optional(),
      role: z.enum(['Main', 'Supporting', 'Antagonist']).default('Supporting'),
      about: z.string().optional()
    })
  }),
  charactersController.safe(charactersController.save)
);

/**
 * ✍️ ATUALIZAR PERSONAGEM
 * PATCH /api/v1/characters/:id
 */
router.patch(
  '/:id',
  roleMiddleware(Roles.ADMIN, Roles.MODERADOR),
  upload.single('image'),
  validationMiddleware({
    params: z.object({ id: CommonSchema.numericId }),
    body: z.object({
      name: z.string().min(2).max(100).optional(),
      anime_id: z.coerce.number().int().positive().optional(),
      mal_id: z.coerce.number().int().positive().optional(),
      role: z.enum(['Main', 'Supporting', 'Antagonist']).optional(),
      about: z.string().optional()
    })
  }),
  charactersController.safe(charactersController.save)
);

/**
 * 🗑️ REMOVER PERSONAGEM
 * DELETE /api/v1/characters/:id
 */
router.delete(
  '/:id',
  roleMiddleware(Roles.ADMIN),
  validationMiddleware({
    params: z.object({ id: CommonSchema.numericId })
  }),
  charactersController.safe(charactersController.delete)
);

module.exports = router;