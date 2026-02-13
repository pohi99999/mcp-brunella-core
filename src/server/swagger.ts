import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';

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
  apis: [
    path.join(process.cwd(), 'src', 'server', 'web.ts'),
    path.join(process.cwd(), 'src', 'server', '*.ts'),
    path.join(process.cwd(), 'src', 'server', 'routes', '*.ts'),
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
