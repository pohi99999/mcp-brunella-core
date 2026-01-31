import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Brunella Agent System API',
      version: '1.0.0',
      description: 'API documentation for the BAS Core MCP Server',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Local server',
      },
    ],
  },
  apis: ['./src/server/web.ts'], // Path to the API docs
};

export const swaggerSpec = swaggerJsdoc(options);
