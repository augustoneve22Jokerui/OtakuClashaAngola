const express = require('express');
const notificationsController = require('./notifications.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const validationMiddleware = require('../../middlewares/validation.middleware');
const CommonSchema = require('../../validators/common.schema');
const { z } = require('zod');

const router = express.Router();

/**
 * Todas as rotas de notificações exigem autenticação.
 */
router.use(authMiddleware);

/**
 * Listar notificações do usuário logado.
 * GET /api/v1/notifications
 */
router.get(
  '/',
  validationMiddleware({
    query: CommonSchema.pagination.extend({
      unreadOnly: z.enum(['true', 'false']).optional()
    })
  }),
  notificationsController.safe(notificationsController.list)
);

/**
 * Obter contagem de mensagens não lidas.
 * GET /api/v1/notifications/unread-count
 */
router.get(
  '/unread-count',
  notificationsController.safe(notificationsController.getUnreadCount)
);

/**
 * Marcar uma notificação específica como lida.
 * PATCH /api/v1/notifications/:id/read
 */
router.patch(
  '/:id/read',
  validationMiddleware({
    params: z.object({ id: CommonSchema.uuid })
  }),
  notificationsController.safe(notificationsController.markRead)
);

/**
 * Marcar todas as notificações do usuário como lidas.
 * POST /api/v1/notifications/read-all
 */
router.post(
  '/read-all',
  notificationsController.safe(notificationsController.markAllRead)
);

/**
 * Remover uma notificação específica.
 * DELETE /api/v1/notifications/:id
 */
router.delete(
  '/:id',
  validationMiddleware({
    params: z.object({ id: CommonSchema.uuid })
  }),
  notificationsController.safe(notificationsController.delete)
);

module.exports = router;