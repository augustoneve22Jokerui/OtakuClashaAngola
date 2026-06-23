/**
 * 🚀 OTAKU CLASH ANGOLA - NÚCLEO DA APLICAÇÃO (CLEAN ARCHITECTURE)
 * Versão: 2.0.0 - Enterprise Resilient
 * Descrição: Configuração de segurança, middlewares globais e orquestração de rotas.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');

// Middlewares Internos
const { loggingMiddleware, payloadLogger } = require('./middlewares/logging.middleware');
const errorMiddleware = require('./middlewares/error.middleware');
const routes = require('./routes/index');
const AppError = require('./core/errors/AppError');
const env = require('./config/env');
const setupSwagger = require('./docs/swaggerConfig');

const app = express();

/**
 * 🛡️ CONFIGURAÇÃO DE CORS (Cross-Origin Resource Sharing)
 * Suporte a múltiplos domínios e comunicação segura com Mobile/Admin.
 */
const allowedOrigins = [
  'https://otakuclash.onrender.com',      // Frontend Admin Produção
  'https://otakuclashaangola.onrender.com', // Backend Próprio (Self-reference)
  'http://localhost:3000',                // Desenvolvimento Local Admin
  'http://localhost:5000',                // Desenvolvimento Local Backend
  'http://localhost:8080'                 // Simuladores Flutter/Web
];

app.use(cors({
  origin: function (origin, callback) {
    // 1. Permite requisições sem origin (Mobile Apps, Postman, cURL)
    if (!origin) return callback(null, true);
    
    // 2. Valida se a origem está na lista permitida ou se está em ambiente dev
    const isAllowed = allowedOrigins.indexOf(origin) !== -1;
    const isDevelopment = env.NODE_ENV === 'development';

    if (isAllowed || isDevelopment) {
      callback(null, true);
    } else {
      console.warn(`[Security:CORS] Tentativa de acesso bloqueada para origem: ${origin}`);
      callback(new AppError(`A origem ${origin} não possui permissão de acesso via CORS.`, 403));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept', 
    'x-no-cache', 
    'Origin',
    'fcm-token' // Suporte a notificações push
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  credentials: true, // Essencial para Cookies de sessão e Socket.IO Handshake
  optionsSuccessStatus: 200
}));

/**
 * 🔒 SEGURANÇA (HELMET)
 * Protege contra vulnerabilidades web comuns sem quebrar o ecossistema.
 */
app.use(helmet({
  // Desabilitado para não conflitar com CDNs do Dashboard e scripts inline necessários
  contentSecurityPolicy: false, 
  // Permite que o App Flutter e Admin carreguem imagens do Supabase Storage
  crossOriginResourcePolicy: { policy: "cross-origin" },
  // Necessário para o bom funcionamento do Socket.IO em alguns browsers
  crossOriginEmbedderPolicy: false
}));

/**
 * ⚡ PERFORMANCE
 */
app.use(compression()); // Compactação Gzip para reduzir payload de rede

/**
 * 📦 PARSERS DE PAYLOAD
 */
// Limite aumentado para suportar uploads de imagens em Base64 se necessário
app.use(express.json({ limit: '15mb' })); 
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

/**
 * 📊 MONITORAMENTO E LOGS
 */
if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}
app.use(loggingMiddleware);
app.use(payloadLogger);

/**
 * 📂 ARQUIVOS ESTÁTICOS
 */
app.use('/public', express.static(path.join(__dirname, '../public')));

/**
 * 📖 DOCUMENTAÇÃO API (SWAGGER)
 */
setupSwagger(app);

/**
 * 🛣️ ROTEAMENTO PRINCIPAL
 */
// Prefixo opcional /api/v1 pode ser adicionado aqui ou mantido no roteador de índice
app.use('/', routes);

/**
 * 🔍 TRATAMENTO DE ROTAS NÃO ENCONTRADAS (404)
 */
app.all('*', (req, res, next) => {
  next(AppError.notFound(`O recurso [ ${req.method} ${req.originalUrl} ] não existe no ecossistema Otaku Clash.`));
});

/**
 * 🚨 MIDDLEWARE DE ERRO GLOBAL
 * Último recurso do pipeline para capturar e formatar exceções.
 */
app.use(errorMiddleware);

module.exports = app;