/**
 * 🚀 OTAKU CLASH ANGOLA - APP CORE ORCHESTRATOR
 * Versão: 3.0.0 - Ultra Robust "Full-Full" Edition
 * Descrição: Configuração de infraestrutura, segurança, CORS e pipeline de requisições.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');

// Core Infrastructure
const env = require('./config/env');
const AppError = require('./core/errors/AppError');
const errorMiddleware = require('./middlewares/error.middleware');
const { loggingMiddleware, payloadLogger } = require('./middlewares/logging.middleware');
const routes = require('./routes/index');
const setupSwagger = require('./docs/swaggerConfig');

const app = express();

/**
 * 🛡️ CONFIGURAÇÃO DE SEGURANÇA (HELMET)
 * Protege contra vulnerabilidades comuns (XSS, Clickjacking, etc).
 */
app.use(helmet({
  // Desabilitado para permitir o carregamento de recursos do Dashboard Admin e CDNs
  contentSecurityPolicy: false,
  // Permite que o App Flutter e Admin carreguem imagens de origens cruzadas (Supabase/S3)
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));

/**
 * 🌐 CONFIGURAÇÃO DE CORS (ZERO COMMUNICATION ERRORS)
 * Implementação resiliente para garantir acesso do Flutter e Dashboard Admin.
 */
const allowedOrigins = [
  'https://otakuclash.onrender.com',      // Frontend Admin Produção
  'https://otakuclashaangola.onrender.com', // Self-reference (Backend)
  'http://localhost:3000',                // Desenvolvimento Local Admin
  'http://localhost:5000',                // Desenvolvimento Local Backend
  'http://localhost:8080'                 // Simuladores Flutter/Web
];

app.use(cors({
  origin: function (origin, callback) {
    // 1. Permite requisições sem origin (Apps Mobile Flutter, Postman, cURL)
    if (!origin) return callback(null, true);
    
    // 2. Validação dinâmica de domínios permitidos
    const isAllowed = allowedOrigins.includes(origin);
    const isDev = env.NODE_ENV === 'development';

    if (isAllowed || isDev) {
      callback(null, true);
    } else {
      console.error(`[Security:CORS] Origem bloqueada: ${origin}`);
      callback(new Error('Bloqueado pelo CORS: Origem não autorizada.'), false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept', 
    'x-no-cache',
    'fcm-token',
    'timezone'
  ],
  exposedHeaders: ['Content-Disposition'],
  credentials: true, // Obrigatório para handshakes de Socket.IO e Cookies
  optionsSuccessStatus: 200
}));

/**
 * ⚡ PERFORMANCE E INFRAESTRUTURA
 */
app.use(compression()); // Compactação Gzip para todas as respostas
app.use(express.json({ limit: '15mb' })); // Suporte a payloads pesados (Uploads Base64)
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

/**
 * 📊 MONITORAMENTO E AUDITORIA
 */
if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}
app.use(loggingMiddleware); // Log de tráfego centralizado
app.use(payloadLogger);     // Debug de payloads em desenvolvimento

/**
 * 📂 RECURSOS ESTÁTICOS
 */
app.use('/public', express.static(path.join(__dirname, '../public')));

/**
 * 📖 DOCUMENTAÇÃO (SWAGGER)
 */
setupSwagger(app);

/**
 * 🛣️ ROTEAMENTO UNIFICADO (API V1)
 * Centraliza todos os módulos (Auth, Quiz, Wallet, Admin, etc).
 */
app.use('/', routes);

/**
 * 🔍 HANDLER DE ROTAS INEXISTENTES (404)
 */
app.all('*', (req, res, next) => {
  next(AppError.notFound(`O recurso [ ${req.method} ${req.originalUrl} ] não foi localizado no servidor Otaku Clash.`));
});

/**
 * 🚨 HANDLER DE ERROS GLOBAL (THE FINAL DEFENSE)
 * Garante que NENHUM erro derrube o processo e que as respostas sejam JSON.
 */
app.use(errorMiddleware);

module.exports = app;
