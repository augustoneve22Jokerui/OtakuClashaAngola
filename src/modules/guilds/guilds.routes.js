const express = require('express');
const guildsController = require('./guilds.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const validationMiddleware = require('../../middlewares/validation.middleware');
const CommonSchema = require('../../validators/common.schema');
const { z } = require('zod');

const router = express.Router();

/**
 * Todas as rotas de clãs exigem que o usuário esteja autenticado.
 */
router.use(authMiddleware);

/**
 * Listar guildas e buscar por nome.
 * GET /api/v1/guilds
 */
router.get(
  '/',
  validationMiddleware({
    query: CommonSchema.pagination.extend({
      search: z.string().optional()
    })
  }),
  guildsController.safe(guildsController.list)
);

/**
 * Criar uma nova guilda.
 * POST /api/v1/guilds
 */
router.post(
  '/',
  validationMiddleware({
    body: z.object({
      name: z.string().min(3, 'Nome muito curto').max(50, 'Nome muito longo'),
      tag: z.string().min(3).max(5, 'A TAG deve ter entre 3 e 5 caracteres').toUpperCase(),
      description: z.string().max(255).optional(),
      logo_url: z.string().url('URL da logo inválida').optional()
    })
  }),
  guildsController.safe(guildsController.create)
);

/**
 * Obter a guilda do usuário logado.
 * GET /api/v1/guilds/me
 */
router.get(
  '/me',
  guildsController.safe(guildsController.getMyGuild)
);

/**
 * Detalhes de uma guilda específica.
 * GET /api/v1/guilds/:id
 */
router.get(
  '/:id',
  validationMiddleware({
    params: z.object({ id: CommonSchema.uuid })
  }),
  guildsController.safe(guildsController.getDetails)
);

/**
 * Solicitar entrada em uma guilda.
 * POST /api/v1/guilds/:id/join
 */
router.post(
  '/:id/join',
  validationMiddleware({
    params: z.object({ id: CommonSchema.uuid })
  }),
  guildsController.safe(guildsController.join)
);

/**
 * Sair da guilda.
 * POST /api/v1/guilds/:id/leave
 */
router.post(
  '/:id/leave',
  validationMiddleware({
    params: z.object({ id: CommonSchema.uuid })
  }),
  guildsController.safe(guildsController.leave)
);

/**
 * Atualizar rank de um membro (Líder apenas).
 * PATCH /api/v1/guilds/:id/members/:userId/rank
 */
router.patch(
  '/:id/members/:userId/rank',
  validationMiddleware({
    params: z.object({ 
      id: CommonSchema.uuid,
      userId: CommonSchema.uuid
    }),
    body: z.object({
      rank: z.enum(['LEADER', 'OFFICER', 'MEMBER'])
    })
  }),
  guildsController.safe(guildsController.updateMemberRank)
);

/**
 * Expulsar membro (Líder ou Oficial).
 * DELETE /api/v1/guilds/:id/members/:userId
 */
router.delete(
  '/:id/members/:userId',
  validationMiddleware({
    params: z.object({ 
      id: CommonSchema.uuid,
      userId: CommonSchema.uuid
    })
  }),
  guildsController.safe(guildsController.kickMember)
);

module.exports = router;