/**
 * 🚀 OTAKU CLASH ANGOLA - APP CORE ORCHESTRATOR
 * Versão: 3.3.0 - Security & Headers Alignment
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');

const env = require('./config/env');
const errorMiddleware = require('./middlewares/error.middleware');
const { loggingMiddleware, payloadLogger } = require('./middlewares/logging.middleware');
const routes = require('./routes/index');

const app = express();

app.set('trust proxy', 1);

// HELMET CONFIG: RELAXADO PARA MAPS E SCRIPTS ADMIN
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://cdn.socket.io"],
      "connect-src": ["'self'", "https://*", "wss://*", "ws://*"],
      "img-src": ["'self'", "data:", "https://*", "blob:"],
      "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"]
    }
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'Accept', 
    'X-App-Version', 
    'x-no-cache'
  ],
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(compression());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use(loggingMiddleware);
app.use(payloadLogger);

app.use('/public', express.static(path.join(__dirname, '../public')));

app.use('/', routes);

app.use(errorMiddleware);

module.exports = app;
