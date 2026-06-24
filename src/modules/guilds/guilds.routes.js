/**
 * 🛡️ OTAKU CLASH ANGOLA - GUILDS ROUTES
 * Versão: 2.0.0 - Enterprise Secured (Final Version)
 * Descrição: Endpoints para gestão de clãs, membros, patentes e interações sociais.
 */

const express = require('express');
const guildsController = require('./guilds.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');
const validationMiddleware = require('../../middlewares/validation.middleware');
const { Roles } = require('../../core/constants/Roles');
const CommonSchema = require('../../validators/common.schema');
const { z } = require('zod');

const router = express.Router();

/**
 * 🔒 PROTEÇÃO DE SESSÃO GLOBAL
 * Todas as rotas de clãs exigem que o utilizador esteja autenticado via JWT.
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
 * Retorna os detalhes do clã ao qual o utilizador logado pertence.
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
      name: z.string()
        .min(3, 'O nome do clã deve ter pelo menos 3 caracteres')
        .max(50, 'Nome demasiado longo'),
      tag: z.string()
        .min(3, 'A TAG deve ter pelo menos 3 caracteres')
        .max(5, 'A TAG deve ter no máximo 5 caracteres')
        .toUpperCase(),
      description: z.string().max(255, 'Descrição demasiado longa').optional(),
      logo_url: z.string().url('A URL do logo é inválida').optional()
    })
  }),
  guildsController.safe(guildsController.create)
);

/**
 * 🔍 CONSULTAR DETALHES DE UMA GUILDA ESPECÍFICA
 * GET /api/v1/guilds/:id
 * FIX: Corrigido ReferenceError de charactersController para guildsController.
 */
router.get(
  '/:id',
  validationMiddleware({
    params: z.object({ id: CommonSchema.uuid })
  }),
  guildsController.safe(guildsController.getDetails)
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
 * ROTAS DE MODERAÇÃO E LIDERANÇA INTERNA
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
      rank: z.enum(['OFFICER', 'MEMBER'], {
        errorMap: () => ({ message: "A patente deve ser OFFICER ou MEMBER" })
      })
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
