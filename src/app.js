/**
 * 🚀 OTAKU CLASH ANGOLA - NÚCLEO DA APLICAÇÃO (APP.JS)
 * Versão: Ultra Mega Final - Enterprise Grade
 * Descrição: Configuração de segurança, CORS ilimitado para origens confiáveis e roteamento.
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
 * Resolve permanentemente bloqueios de comunicação entre Frontend e Backend.
 */
const allowedOrigins = [
  'https://otakuclash.onrender.com', // Sua URL real do Frontend Admin
  'http://localhost:3000',           // Desenvolvimento Local Frontend
  'http://localhost:5000'            // Desenvolvimento Local Backend
];

app.use(cors({
  origin: function (origin, callback) {
    // Permite requisições sem origin (como mobile apps ou curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Bloqueado pelo CORS: Origem não permitida por razões de segurança.'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'x-no-cache'],
  credentials: true, // Essencial para cookies e sessões Socket.IO
  optionsSuccessStatus: 200
}));

/**
 * 🔒 SEGURANÇA E PERFORMANCE
 */
app.use(helmet({
  contentSecurityPolicy: false, // Desabilitado para não conflitar com CDNs do Frontend EJS
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(compression()); // Compactação Gzip para alta performance

/**
 * 📦 PARSERS DE PAYLOAD
 */
app.use(express.json({ limit: '10mb' })); // Suporte a JSON pesado (uploads base64)
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
 * Para servir documentação ou imagens locais se necessário
 */
app.use('/public', express.static(path.join(__dirname, '../public')));

/**
 * 📖 DOCUMENTAÇÃO API (SWAGGER)
 */
setupSwagger(app);

/**
 * 🚦 ROTEAMENTO PRINCIPAL
 */
app.use('/', routes);

/**
 * ❓ TRATAMENTO DE ROTAS NÃO ENCONTRADAS (404)
 */
app.all('*', (req, res, next) => {
  next(AppError.notFound(`O recurso [ ${req.method} ${req.originalUrl} ] não existe no ecossistema Otaku Clash.`));
});

/**
 * 🚨 MIDDLEWARE DE ERRO GLOBAL
 * Captura todos os erros da aplicação e formata para o Frontend
 */
app.use(errorMiddleware);

module.exports = app;
