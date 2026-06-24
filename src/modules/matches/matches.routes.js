/**
 * 🛣️ OTAKU CLASH ANGOLA - MATCHES ROUTES
 * Versão: 2.0.0 - Enterprise Secured
 * Descrição: Endpoints para gestão de arenas, duelos 1v1 e monitoramento em tempo real.
 */

const express = require('express');
const matchesController = require('./matches.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');
const validationMiddleware = require('../../middlewares/validation.middleware');
const { Roles } = require('../../core/constants/Roles');
const { MatchTypes } = require('../../core/constants/MatchTypes');
const CommonSchema = require('../../validators/common.schema');
const { z } = require('zod');

const router = express.Router();

/**
 * 🔒 PROTEÇÃO DE SESSÃO
 * Todas as rotas de arenas exigem utilizador autenticado via JWT.
 */
router.use(authMiddleware);

/**
 * ==================================================
 * ROTAS ADMINISTRATIVAS (STAFF ONLY)
 * Definidas primeiro para evitar conflitos com /:id
 * ==================================================
 */

/**
 * 🕵️ MONITOR DE ARENA: LISTAR PARTIDAS EM ANDAMENTO
 * GET /api/v1/matches/admin/live
 */
router.get(
  '/admin/live',
  roleMiddleware(Roles.ADMIN, Roles.MODERADOR),
  matchesController.safe(matchesController.listLive)
);

/**
 * 🛠️ FINALIZAÇÃO MANUAL / RECONSTITUIÇÃO DE RESULTADOS
 * Utilizado pela STAFF em caso de falha técnica no WebSocket.
 * PATCH /api/v1/matches/:id/finish
 */
router.patch(
  '/:id/finish',
  roleMiddleware(Roles.ADMIN),
  validationMiddleware({
    params: z.object({ id: CommonSchema.uuid }),
    body: z.object({
      results: z.array(z.object({
        userId: CommonSchema.uuid,
        score: z.number().int().min(0),
        correctAnswers: z.number().int().min(0),
        avgTime: z.number().min(0)
      })).min(1)
    })
  }),
  matchesController.safe(matchesController.manualFinish)
);

/**
 * 🛑 ABORTAR PARTIDA (INTERRUPÇÃO ADMINISTRATIVA)
 * PATCH /api/v1/matches/:id/abort
 */
router.patch(
  '/:id/abort',
  roleMiddleware(Roles.ADMIN),
  validationMiddleware({
    params: z.object({ id: CommonSchema.uuid }),
    body: z.object({
      reason: z.string().min(5).max(255)
    })
  }),
  matchesController.safe(matchesController.abort)
);

/**
 * ==================================================
 * ROTAS DE UTILIZADOR (PLAYER ACTIONS)
 * ==================================================
 */

/**
 * 🏗️ INICIALIZAR NOVA PARTIDA (DUELO OU QUICK PLAY)
 * POST /api/v1/matches
 */
router.post(
  '/',
  validationMiddleware({
    body: z.object({
      type: z.nativeEnum(MatchTypes).default(MatchTypes.QUICK_PLAY),
      entryFee: z.coerce.number().min(0).default(0),
      animeId: z.coerce.number().int().positive().optional()
    })
  }),
  matchesController.safe(matchesController.create)
);

/**
 * 🔑 ENTRAR EM PARTIDA VIA CÓDIGO DE SALA
 * POST /api/v1/matches/join
 */
router.post(
  '/join',
  validationMiddleware({
    body: z.object({
      roomCode: z.string().length(6, 'O código da sala deve ter 6 caracteres').toUpperCase()
    })
  }),
  matchesController.safe(matchesController.joinByCode)
);

/**
 * 📑 MEU HISTÓRICO DE PARTIDAS (PAGINADO)
 * GET /api/v1/matches/history
 */
router.get(
  '/history',
  validationMiddleware({
    query: CommonSchema.pagination
  }),
  matchesController.safe(matchesController.getMyHistory)
);

/**
 * 🔍 CONSULTAR DETALHES DE UMA PARTIDA ESPECÍFICA
 * GET /api/v1/matches/:id
 */
router.get(
  '/:id',
  validationMiddleware({
    params: z.object({ id: CommonSchema.uuid })
  }),
  matchesController.safe(matchesController.getDetails)
);

module.exports = router;