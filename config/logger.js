const winston = require('winston');
const env = require('./env');

/**
 * Definição de níveis de severidade personalizados
 */
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

/**
 * Cores para cada nível (visível apenas no console)
 */
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

/**
 * Formato comum para logs de arquivo (JSON estruturado)
 */
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Formato amigável para console (Colorido e legível)
 */
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}${info.stack ? `\n${info.stack}` : ''}`
  )
);

/**
 * Configuração dos transportes (destinos dos logs)
 */
const transports = [
  // Transporte de Console (Sempre ativo)
  new winston.transports.Console({
    format: consoleFormat,
  }),
  // Transporte para Erros (Apenas em Produção/Staging para persistência)
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    format: fileFormat,
  }),
  // Transporte para Todos os Logs
  new winston.transports.File({ 
    filename: 'logs/combined.log',
    format: fileFormat,
  }),
];

/**
 * Instância principal do Logger
 */
const logger = winston.createLogger({
  level: env.LOG_LEVEL || 'info',
  levels,
  transports,
  // Não interromper o processo em caso de erro no log
  exitOnError: false,
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log', format: fileFormat }),
    new winston.transports.Console({ format: consoleFormat })
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log', format: fileFormat }),
    new winston.transports.Console({ format: consoleFormat })
  ],
});

/**
 * Helper para logging de requisições HTTP (integrado com Morgan)
 */
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

module.exports = logger;