const express = require('express');
const rankingsController = require('./rankings.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');
const validationMiddleware = require('../../middlewares/validation.middleware');
const { Roles } = require('../../core/constants/Roles');
const CommonSchema = require('../../validators/common.schema');
const { z } = require('zod');

const router = express.Router();

/**
 * Rotas Públicas/Semi-públicas (Podem ser acessadas sem login ou apenas com login)
 */

// Listar o ranking de elite (Top Players por LP)
router.get(
  '/top',
  validationMiddleware({
    query: CommonSchema.pagination.extend({
      limit: z.coerce.number().int().min(1).max(100).default(50)
    })
  }),
  rankingsController.safe(rankingsController.getTopPlayers)
);

// Obter estatísticas de distribuição de Tiers na temporada
router.get(
  '/stats/distribution',
  rankingsController.safe(rankingsController.getTierDistribution)
);

/**
 * Rotas Privadas (Requerem autenticação)
 */
router.use(authMiddleware);

// Obter o perfil competitivo detalhado do usuário logado (Tier, LP, Posição)
router.get(
  '/me',
  rankingsController.safe(rankingsController.getMyRank)
);

/**
 * Rotas Administrativas (Apenas ADMIN)
 */

// Reset de temporada: limpa LPs e prepara para nova jornada competitiva
router.post(
  '/admin/reset-season',
  roleMiddleware(Roles.ADMIN),
  rankingsController.safe(rankingsController.resetSeason)
);

module.exports = router;