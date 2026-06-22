const express = require('express');
const battleRoyaleController = require('./battleRoyale.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');
const validationMiddleware = require('../../middlewares/validation.middleware');
const CommonSchema = require('../../validators/common.schema');
const { Roles } = require('../../core/constants/Roles');
const { z } = require('zod');

const router = express.Router();

/**
 * Todas as rotas de Battle Royale exigem autenticação.
 */
router.use(authMiddleware);

/**
 * Listar salas de Battle Royale ativas.
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
 * Criar uma nova sala de Battle Royale.
 * Apenas administradores ou moderadores podem iniciar um evento global.
 * POST /api/v1/battle-royale/rooms
 */
router.post(
  '/rooms',
  roleMiddleware(Roles.ADMIN, Roles.MODERATOR),
  validationMiddleware({
    body: z.object({
      title: z.string().min(5).max(100),
      anime_id: CommonSchema.numericId,
      entry_fee: z.coerce.number().min(0),
      max_players: z.coerce.number().int().min(2).max(1000).default(100)
    })
  }),
  battleRoyaleController.safe(battleRoyaleController.createRoom)
);

/**
 * Inscrição em uma sala de Battle Royale.
 * Realiza o débito da taxa e reserva a vaga.
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
 * Detalhes de uma sala específica.
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
 * Histórico de vencedores recentes.
 * GET /api/v1/battle-royale/winners
 */
router.get(
  '/winners',
  battleRoyaleController.safe(battleRoyaleController.getRecentWinners)
);

module.exports = router;