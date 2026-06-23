const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('../../swagger.json');
const env = require('../config/env');

/**
 * Opções de customização da interface do Swagger UI
 */
const swaggerOptions = {
  customCss: '.swagger-ui .topbar { display: none }', // Remove a barra superior padrão do Swagger
  customSiteTitle: "Otaku Clash Angola - API Documentation",
  customfavIcon: "/assets/favicon.ico",
  swaggerOptions: {
    persistAuthorization: true, // Mantém o token JWT salvo no navegador durante a sessão de teste
    displayRequestDuration: true,
    filter: true,
    docExpansion: 'none', // Mantém as rotas fechadas por padrão para melhor visualização
  },
};

/**
 * Ajusta as URLs de servidor no JSON de documentação com base no ambiente atual
 */
if (env.NODE_ENV === 'production') {
  swaggerDocument.servers = [
    {
      url: env.API_URL.endsWith('/api/v1') ? env.API_URL : `${env.API_URL}/api/v1`,
      description: 'Production Server'
    }
  ];
} else {
  swaggerDocument.servers = [
    {
      url: `http://localhost:${env.PORT}/api/v1`,
      description: 'Local Development Server'
    }
  ];
}

/**
 * Exporta o middleware configurado para ser montado no app.js
 */
const setupSwagger = (app) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerOptions));
  
  // Endpoint JSON puro para exportação ou ferramentas externas (Postman/Insomnia)
  app.get('/api-docs-json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerDocument);
  });
};

module.exports = setupSwagger;