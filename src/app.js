/**
 * 🚀 OTAKU CLASH ANGOLA - APP CORE ORCHESTRATOR
 * Versão: 3.1.0 - Ultra Robust "Zero-Error" Edition
 * Descrição: Configuração de infraestrutura, segurança, CORS e pipeline de requisições.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');

// Middlewares e Configurações
const env = require('./config/env');
const AppError = require('./core/errors/AppError');
const errorMiddleware = require('./middlewares/error.middleware');
const { loggingMiddleware, payloadLogger } = require('./middlewares/logging.middleware');
const routes = require('./routes/index');
const setupSwagger = require('./docs/swaggerConfig');

const app = express();

/**
 * 🌐 CONFIGURAÇÃO DE CORS (ZERO COMMUNICATION ERRORS)
 * Corrigido para permitir cabeçalhos customizados do frontend.
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
    // Permite requisições sem origin (como Mobile Apps Flutter ou cURL)
    if (!origin) return callback(null, true);
    
    const isAllowed = allowedOrigins.includes(origin);
    const isDev = env.NODE_ENV === 'development';

    if (isAllowed || isDev) {
      callback(null, true);
    } else {
      console.error(`[Security:CORS] Origem bloqueada pela política: ${origin}`);
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
    'x-app-version',  // 👈 CORREÇÃO: Adicionado para permitir o cabeçalho do Admin
    'X-App-Version',  // 👈 CORREÇÃO: Case-sensitivity protection
    'timezone'
  ],
  exposedHeaders: ['Content-Disposition'],
  credentials: true,
  optionsSuccessStatus: 200
}));

/**
 * 🔒 SEGURANÇA (HELMET)
 */
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));

/**
 * ⚡ PERFORMANCE E PARSERS
 */
app.use(compression());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

/**
 * 📊 MONITORAMENTO
 */
if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}
app.use(loggingMiddleware);
app.use(payloadLogger);

/**
 * 📂 ARQUIVOS ESTÁTICOS E DOCS
 */
app.use('/public', express.static(path.join(__dirname, '../public')));
setupSwagger(app);

/**
 * 🛣️ ROTEAMENTO UNIFICADO
 * O arquivo routes/index.js já define o prefixo /api/v1
 */
app.use('/', routes);

/**
 * 🔍 TRATAMENTO GLOBAL DE 404
 * Se a requisição chegou aqui, nenhuma rota anterior (incluindo as de /api/v1) capturou.
 */
app.all('*', (req, res, next) => {
  const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  logger.warn(`[Route:NotFound] 404 - ${req.method} ${fullUrl}`);
  
  next(AppError.notFound(`O recurso [ ${req.method} ${req.originalUrl} ] não existe neste servidor.`));
});

/**
 * 🚨 HANDLER DE ERROS GLOBAL
 */
app.use(errorMiddleware);

module.exports = app;
