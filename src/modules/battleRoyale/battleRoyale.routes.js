/**
 * 🛣️ OTAKU CLASH ANGOLA - BATTLE ROYALE ROUTES
 * Versão: 2.0.0 - Enterprise Secured
 * Descrição: Endpoints para gestão de arenas massivas, inscrições e histórico de lendas.
 */

const express = require('express');
const battleRoyaleController = require('./battleRoyale.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');
const validationMiddleware = require('../../middlewares/validation.middleware');
const { Roles } = require('../../core/constants/Roles');
const CommonSchema = require('../../validators/common.schema');
const { z } = require('zod');

const router = express.Router();

/**
 * 🔒 PROTEÇÃO DE SESSÃO
 * Todas as interações com a Arena Battle Royale exigem autenticação.
 */
router.use(authMiddleware);

/**
 * ==================================================
 * ROTAS PÚBLICAS / PLAYER (DENTRO DO MÓDULO)
 * ==================================================
 */

/**
 * 📑 LISTAR ARENAS ACTIVAS
 * GET /api/v1/battle-royale/rooms
 */
router.get(
  '/rooms',
  validationMiddleware({
    query: z.object({
      status: z.enum(['WAITING', 'IN_PROGRESS', 'FINISHED']).optional()
    })
  }),
  battleRoyaleController.safe(battleRoyaleController.listRooms)
);

/**
 * 🏆 FEED DE VENCEDORES RECENTES (HALL DA FAMA)
 * GET /api/v1/battle-royale/winners
 * Nota: Definida antes de /:matchId para evitar conflito de parâmetros.
 */
router.get(
  '/winners',
  battleRoyaleController.safe(battleRoyaleController.getRecentWinners)
);

/**
 * 🔍 CONSULTAR DETALHES DE UMA ARENA
 * GET /api/v1/battle-royale/rooms/:matchId
 */
router.get(
  '/rooms/:matchId',
  validationMiddleware({
    params: z.object({ matchId: CommonSchema.uuid })
  }),
  battleRoyaleController.safe(battleRoyaleController.getRoomDetails)
);

/**
 * 🏃 INSCRIÇÃO EM ARENA (PAGAMENTO E VAGA)
 * POST /api/v1/battle-royale/rooms/:matchId/join
 */
router.post(
  '/rooms/:matchId/join',
  validationMiddleware({
    params: z.object({ matchId: CommonSchema.uuid })
  }),
  battleRoyaleController.safe(battleRoyaleController.joinRoom)
);

/**
 * ==================================================
 * ROTAS ADMINISTRATIVAS (STAFF ONLY)
 * ==================================================
 */

/**
 * 🏗️ ABRIR NOVA ARENA BATTLE ROYALE
 * POST /api/v1/battle-royale/rooms
 */
router.post(
  '/rooms',
  roleMiddleware(Roles.ADMIN, Roles.MODERADOR),
  validationMiddleware({
    body: z.object({
      title: z.string().min(5, 'O título da arena deve ter pelo menos 5 caracteres').max(100),
      anime_id: CommonSchema.numericId,
      entry_fee: z.coerce.number().min(0, 'A taxa não pode ser negativa'),
      max_players: z.coerce.number().int().min(2).max(1000).default(100)
    })
  }),
  battleRoyaleController.safe(battleRoyaleController.createRoom)
);

module.exports = router;