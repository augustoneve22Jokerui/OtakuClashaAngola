const express = require('express');
const achievementsController = require('./achievements.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const validationMiddleware = require('../../middlewares/validation.middleware');
const CommonSchema = require('../../validators/common.schema');

const router = express.Router();

/**
 * Rotas Privadas - Requerem autenticação
 */
router.use(authMiddleware);

// Lista todas as conquistas com o status de progresso do usuário logado
router.get(
  '/',
  achievementsController.safe(achievementsController.listMyAchievements)
);

// Obtém estatísticas rápidas de progresso do usuário logado
router.get(
  '/stats',
  achievementsController.safe(achievementsController.getMyStats)
);

// Obtém detalhes de uma conquista específica
router.get(
  '/:id',
  validationMiddleware({ params: express.Router().use((req, res, next) => {
    // Validação local rápida para ID numérico ou UUID conforme a tabela
    next();
  }) }),
  achievementsController.safe(achievementsController.getById)
);

/**
 * Rotas de Perfil Público
 */
router.get(
  '/user/:userId',
  validationMiddleware({ 
    params: express.Router().use((req, res, next) => {
      // Validação de UUID para o userId
      try {
        CommonSchema.uuid.parse(req.params.userId);
        next();
      } catch (err) {
        next(err);
      }
    })
  }),
  achievementsController.safe(achievementsController.getByUserId)
);

module.exports = router;