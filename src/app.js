/**
 * 🛡️ OTAKU CLASH ANGOLA - NÚCLEO DA APLICAÇÃO (CLEAN ARCHITECTURE)
 * Versão: 2.0.1 - Enterprise Resilient (Production Ready)
 * Descrição:
 * Configuração central da aplicação, segurança,
 * middlewares globais, documentação e roteamento.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');

// ===============================
// INTERNAL IMPORTS
// ===============================

const {
  loggingMiddleware,
  payloadLogger
} = require('./middlewares/logging.middleware');

const errorMiddleware = require('./middlewares/error.middleware');
const routes = require('./routes/index');
const AppError = require('./core/errors/AppError');
const env = require('./config/env');
const setupSwagger = require('./docs/swaggerConfig');

// ===============================
// APP INSTANCE
// ===============================

const app = express();

// ===============================
// CORS CONFIGURATION
// ===============================

const allowedOrigins = [
  // PRODUÇÃO
  'https://otakuclash.onrender.com',
  'https://otakuclashaangola.onrender.com',

  // LOCAL
  'http://localhost:3000',
  'http://localhost:5000',
  'http://localhost:8080'
];

app.use(cors({
  origin: (origin, callback) => {

    /**
     * Mobile Apps
     * Flutter
     * Postman
     * cURL
     * Internal Services
     */
    if (!origin) {
      return callback(null, true);
    }

    const isAllowed =
      allowedOrigins.includes(origin);

    const isDevelopment =
      env.NODE_ENV === 'development';

    if (isAllowed || isDevelopment) {
      return callback(null, true);
    }

    console.warn(
      `[Security:CORS] Origem bloqueada: ${origin}`
    );

    return callback(
      new AppError(
        `A origem ${origin} não possui permissão de acesso.`,
        403
      )
    );
  },

  credentials: true,

  methods: [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS'
  ],

  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'x-no-cache',
    'fcm-token',

    // ADMIN DASHBOARD
    'x-app-version',

    // SOCKET.IO
    'x-socket-id'
  ],

  exposedHeaders: [
    'Content-Range',
    'X-Content-Range'
  ],

  optionsSuccessStatus: 200
}));

// ===============================
// SECURITY
// ===============================

app.use(
  helmet({
    contentSecurityPolicy: false,

    crossOriginResourcePolicy: {
      policy: 'cross-origin'
    },

    crossOriginEmbedderPolicy: false
  })
);

// ===============================
// PERFORMANCE
// ===============================

app.use(compression());

// ===============================
// BODY PARSERS
// ===============================

app.use(
  express.json({
    limit: '15mb'
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '15mb'
  })
);

// ===============================
// REQUEST LOGGING
// ===============================

if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use(loggingMiddleware);
app.use(payloadLogger);

// ===============================
// STATIC FILES
// ===============================

app.use(
  '/public',
  express.static(
    path.join(__dirname, '../public')
  )
);

// ===============================
// HEALTH CHECK
// ===============================

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'Otaku Clash Angola API',
    version: '2.0.1',
    environment: env.NODE_ENV,
    status: 'ONLINE',
    timestamp: new Date().toISOString()
  });
});

// ===============================
// API DOCS
// ===============================

setupSwagger(app);

// ===============================
// ROUTES
// ===============================

app.use('/', routes);

// ===============================
// NOT FOUND
// ===============================

app.all('*', (req, res, next) => {
  next(
    AppError.notFound(
      `O recurso [ ${req.method} ${req.originalUrl} ] não existe no ecossistema Otaku Clash Angola.`
    )
  );
});

// ===============================
// GLOBAL ERROR HANDLER
// ===============================

app.use(errorMiddleware);

// ===============================
// EXPORT
// ===============================

module.exports = app;
