/**
 * 🛡️ OTAKU CLASH ANGOLA - GUILDS ROUTES
 * Versão: 2.0.0 - Enterprise Secured
 * Descrição: Endpoints para gestão de clãs, membros, patentes e interações sociais.
 */

const express = require('express');
const guildsController = require('./guilds.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const validationMiddleware = require('../../middlewares/validation.middleware');
const CommonSchema = require('../../validators/common.schema');
const { z } = require('zod');

const router = express.Router();

/**
 * 🔒 PROTEÇÃO DE SESSÃO
 * Todas as rotas sociais exigem utilizador autenticado via JWT.
 */
router.use(authMiddleware);

/**
 * ==================================================
 * ROTAS DE UTILIZADOR (PLAYER ACTIONS)
 * ==================================================
 */

/**
 * 📑 DIRECTÓRIO DE GUILDAS
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
 * 🆔 OBTER MINHA GUILDA
 * GET /api/v1/guilds/me
 * Nota: Definida antes de /:id para evitar conflito.
 */
router.get(
  '/me',
  guildsController.safe(guildsController.getMyGuild)
);

/**
 * 🏗️ FUNDAR NOVO CLÃ (CUSTO: 5.000 AKZ)
 * POST /api/v1/guilds
 */
router.post(
  '/',
  validationMiddleware({
    body: z.object({
      name: z.string().min(3, 'O nome do clã deve ter pelo menos 3 caracteres').max(50),
      tag: z.string().min(3).max(5, 'A TAG deve ter entre 3 e 5 caracteres').toUpperCase(),
      description: z.string().max(255).optional(),
      logo_url: z.string().url('A URL do logo é inválida').optional()
    })
  }),
  guildsController.safe(guildsController.create)
);

/**
 * 🔍 CONSULTAR DETALHES DE UMA GUILDA
 * GET /api/v1/guilds/:id
 */
router.get(
  '/:id',
  validationMiddleware({
    params: z.object({ id: CommonSchema.uuid })
  }),
  guildsController.safe(charactersController.getDetails)
);

/**
 * 🤝 SOLICITAR ENTRADA EM UM CLÃ
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
 * 🏃 SAIR VOLUNTARIAMENTE DO CLÃ
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
 * ==================================================
 * ROTAS DE MODERAÇÃO E LIDERANÇA
 * ==================================================
 */

/**
 * 🔨 ATUALIZAR PATENTE DE MEMBRO (LÍDER APENAS)
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
      rank: z.enum(['OFFICER', 'MEMBER'])
    })
  }),
  guildsController.safe(guildsController.updateMemberRank)
);

/**
 * 🚫 EXPULSAR MEMBRO (LÍDER OU OFICIAL)
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

/**
 * 🗑️ DISSOLVER CLÃ (LÍDER OU ADMIN)
 * DELETE /api/v1/guilds/:id
 */
router.delete(
  '/:id',
  validationMiddleware({
    params: z.object({ id: CommonSchema.uuid })
  }),
  guildsController.safe(guildsController.disband)
);

module.exports = router;