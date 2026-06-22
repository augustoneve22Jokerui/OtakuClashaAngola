const express = require('express');
const tournamentsController = require('./tournaments.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');
const validationMiddleware = require('../../middlewares/validation.middleware');
const { Roles } = require('../../core/constants/Roles');
const CommonSchema = require('../../validators/common.schema');
const { z } = require('zod');

const router = express.Router();

/**
 * Rotas Públicas (Disponíveis para visualização de qualquer usuário)
 */

// Listar torneios ativos e futuros
router.get(
  '/',
  validationMiddleware({
    query: CommonSchema.pagination.extend({
      status: z.enum(['REGISTRATION', 'IN_PROGRESS', 'FINISHED', 'CANCELLED']).optional(),
      animeId: CommonSchema.numericId.optional()
    })
  }),
  tournamentsController.safe(tournamentsController.list)
);

// Detalhes completos de um torneio específico
router.get(
  '/:id',
  validationMiddleware({
    params: z.object({ id: CommonSchema.uuid })
  }),
  tournamentsController.safe(tournamentsController.getDetails)
);

/**
 * Rotas Privadas (Requerem autenticação do usuário)
 */
router.use(authMiddleware);

// Inscrição do usuário logado no torneio
router.post(
  '/:id/register',
  validationMiddleware({
    params: z.object({ id: CommonSchema.uuid })
  }),
  tournamentsController.safe(tournamentsController.register)
);

// Cancelamento de inscrição (apenas em fase de registro)
router.delete(
  '/:id/unregister',
  validationMiddleware({
    params: z.object({ id: CommonSchema.uuid })
  }),
  tournamentsController.safe(tournamentsController.unregister)
);

// Listar torneios onde o usuário autenticado está inscrito
router.get(
  '/me/participation',
  tournamentsController.safe(tournamentsController.getMyTournaments)
);

/**
 * Rotas Administrativas (Apenas ADMIN ou MODERATOR)
 */

// Atualizar status do torneio (Iniciar, Finalizar, Cancelar)
router.patch(
  '/:id/status',
  roleMiddleware(Roles.ADMIN, Roles.MODERADOR),
  validationMiddleware({
    params: z.object({ id: CommonSchema.uuid }),
    body: z.object({
      status: z.enum(['REGISTRATION', 'IN_PROGRESS', 'FINISHED', 'CANCELLED'])
    })
  }),
  tournamentsController.safe(tournamentsController.updateStatus)
);

module.exports = router;