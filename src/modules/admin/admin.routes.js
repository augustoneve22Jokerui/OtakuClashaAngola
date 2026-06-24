/**
 * 🛣️ OTAKU CLASH ANGOLA - ADMIN ROUTES
 * Versão: 2.1.0 - Enterprise Secured & Settings Integration
 * Descrição: Definição de rotas e endpoints restritos à equipe administrativa, 
 *            auditoria transacional e rotinas de manutenção de infraestrutura.
 */

const express = require('express');
const adminController = require('./admin.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');
const validationMiddleware = require('../../middlewares/validation.middleware');
const CommonSchema = require('../../validators/common.schema');
const { Roles } = require('../../core/constants/Roles');
const { z } = require('zod');

const router = express.Router();

/**
 * 🔒 PROTEÇÃO GLOBAL DO MÓDULO (RBAC LAYER)
 * Todas as rotas declaradas neste arquivo exigem obrigatoriamente um token JWT ativo 
 * e nível de privilégio administrativo do tipo Roles.ADMIN.
 */
router.use(authMiddleware);
router.use(roleMiddleware(Roles.ADMIN));

/**
 * 📊 DASHBOARD OVERVIEW
 * Retorna contagens de alto nível, usuários em tempo real e volume transacional financeiro.
 * GET /api/v1/admin/dashboard
 */
router.get(
  '/dashboard',
  adminController.safe(adminController.getDashboard)
);

/**
 * ⚙️ CONFIGURAÇÕES OPERACIONAIS DO SISTEMA (SISTEMA DE CONFIGS GLOBAIS)
 * Recupera os parâmetros estruturais vigentes no ecossistema de produção.
 * GET /api/v1/admin/settings
 */
router.get(
  '/settings',
  adminController.safe(adminController.getSettings)
);

/**
 * 💾 SALVAR CONFIGURAÇÕES DO SISTEMA (UPSERT ADM)
 * Atualiza os metadados dinâmicos e regras de negócios vitais da aplicação.
 * POST /api/v1/admin/settings
 */
router.post(
  '/settings',
  validationMiddleware({
    body: z.object({
      app_name: z.string().min(1, 'O nome da aplicação não pode estar vazio.').trim(),
      maintenance_mode: z.boolean().default(false)
    })
  }),
  adminController.safe(adminController.updateSettings)
);

/**
 * 🛡️ GESTÃO DE PERMISSÕES E ACESSOS (RBAC)
 * Altera o nível hierárquico e papéis de permissão de um utilizador específico.
 * PATCH /api/v1/admin/users/:userId/role
 */
router.patch(
  '/users/:userId/role',
  validationMiddleware({
    params: z.object({ 
      userId: CommonSchema.uuid 
    }),
    body: z.object({
      role: z.enum([Roles.ADMIN, Roles.MODERADOR, Roles.USUARIO], {
        errorMap: () => ({ message: 'A atribuição de acesso informada é inválida.' })
      })
    })
  }),
  adminController.safe(adminController.changeUserRole)
);

/**
 * 📑 LOGS E TRILHA DE AUDITORIA DIGITAL
 * Lista e rastreia ações críticas e operacionais realizadas pela administração.
 * GET /api/v1/admin/audit-logs
 */
router.get(
  '/audit-logs',
  validationMiddleware({
    query: z.object({
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(1000).optional(), // Sincronizado para suportar a paginação estendida do Admin (Max 1000)
      action: z.string().optional(),
      resourceType: z.string().optional()
    })
  }),
  adminController.safe(adminController.getAuditLogs)
);

/**
 * 🔍 INTEGRIDADE DO CATÁLOGO DE MÍDIAS
 * Relatório automatizado de controle de qualidade para animes órfãos de dados (sem questões ou sem personagens).
 * GET /api/v1/admin/catalog/health
 */
router.get(
  '/catalog/health',
  adminController.safe(adminController.getCatalogHealth)
);

/**
 * 🔄 WORKER DE SINCRONIZAÇÃO HÍBRIDA (MANUAL / CRON)
 * Inicializa rotinas paralelas assíncronas via Jikan V4 API com fallback resiliente para o TMDB.
 * POST /api/v1/admin/sync/animes
 */
router.post(
  '/sync/animes',
  validationMiddleware({
    body: z.object({
      malId: z.number().int().positive('O identificador único MAL ID deve ser um número positivo inteiro.').optional()
    })
  }),
  adminController.safe(adminController.triggerAnimeSync)
);

/**
 * 🧹 MANUTENÇÃO DE INFRAESTRUTURA E HIGIENIZAÇÃO DE CACHE
 * Expura chaves voláteis do Redis diretamente através do Painel Administrativo.
 * POST /api/v1/admin/maintenance/clear-cache
 */
router.post(
  '/maintenance/clear-cache',
  validationMiddleware({
    body: z.object({
      type: z.enum(['ALL', 'MATCHMAKING', 'SESSIONS', 'RANKINGS', 'SYSTEM_SETTINGS']).default('ALL')
    })
  }),
  adminController.safe(adminController.clearCache)
);

module.exports = router;
