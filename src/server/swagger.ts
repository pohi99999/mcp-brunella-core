import swaggerJsdoc from "swagger-jsdoc";
import path from "path";

const options = {
  swaggerDefinition: {
    openapi: "3.0.0",
    info: {
      title: "Brunella Agent System API",
      version: "1.0.0",
      description: "API documentation for the BAS Core MCP Server",
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Local server",
      },
    ],
    paths: {
      "/metrics": {
        get: {
          summary: "Prometheus metrics scrape endpoint",
          description: "Exposes BAS runtime metrics in Prometheus text format.",
          responses: {
            200: {
              description: "Prometheus metrics text payload"
            }
          }
        }
      }
    }
  },
  apis: [
    path.join(process.cwd(), "src", "server", "web.ts"),
    path.join(process.cwd(), "src", "server", "*.ts"),
    path.join(process.cwd(), "src", "server", "routes", "*.ts"),
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
