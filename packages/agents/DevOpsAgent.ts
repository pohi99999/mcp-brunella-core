/**
 * DevOpsAgent - Deployment, CI/CD és infrastructure management
 * Software Genesis Protocol része
 */

import { IAgent, AgentResponse, ISwarmContext } from './types.js';
import { logInfo, logError, setAgentStatus } from '@packages/utils/logger.js';

export interface DeploymentRequest {
  projectName: string;
  platform: 'vercel' | 'netlify' | 'aws' | 'azure' | 'cloudflare';
  environment: 'development' | 'staging' | 'production';
  buildCommand: string;
  envVars?: Record<string, string>;
}

export interface DeploymentOutput {
  status: 'success' | 'failed' | 'pending';
  url?: string;
  buildLogs: string[];
  configFiles: Record<string, string>;
  cicdPipeline?: string;
}

export default class DevOpsAgent implements IAgent {
  name = 'DevOps';
  description =
    'DevOps és deployment - CI/CD pipeline, infrastructure setup, monitoring és scaling';
  role = 'devops';
  capabilities = [
    'deployment_automation',
    'cicd_setup',
    'infrastructure_as_code',
    'monitoring_setup',
    'environment_config',
  ];

  async execute(
    task: string,
    context?: { swarm?: ISwarmContext }
  ): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));

    try {
      logInfo(this.name, `DevOps task: ${task}`);

      // Parse request
      const request = this.parseRequest(task, context);

      // Validate
      if (!request.projectName || !request.platform) {
        return {
          status: 'error',
          error: 'Project name and platform are required',
        };
      }

      logInfo(
        this.name,
        `Deploying "${request.projectName}" to ${request.platform} (${request.environment})`
      );

      // Generate deployment configuration
      const output = await this.setupDeployment(request);

      logInfo(
        this.name,
        `Deployment config ready: ${Object.keys(output.configFiles).length} config files`
      );

      return {
        status: 'success',
        data: output,
      };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, `Deployment setup failed: ${error}`);
      return {
        status: 'error',
        error: `Deployment setup failed: ${error}`,
      };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }

  private parseRequest(
    task: string,
    context?: { swarm?: ISwarmContext }
  ): DeploymentRequest {
    if (context?.swarm?.artifacts?.['deploymentRequest']) {
      return context.swarm.artifacts['deploymentRequest'] as DeploymentRequest;
    }

    // Extract from task
    const projectMatch = task.match(/(?:project|projekt):\s*([^\n,]+)/i);
    const platformMatch = task.match(/(?:platform|felület):\s*(\w+)/i);

    return {
      projectName: projectMatch?.[1]?.trim() || 'unnamed-project',
      platform: (platformMatch?.[1]?.toLowerCase() as any) || 'vercel',
      environment: 'production',
      buildCommand: 'npm run build',
    };
  }

  private async setupDeployment(request: DeploymentRequest): Promise<DeploymentOutput> {
    const configFiles: Record<string, string> = {};

    // Generate platform-specific config
    switch (request.platform) {
      case 'vercel':
        configFiles['vercel.json'] = this.generateVercelConfig(request);
        break;
      case 'netlify':
        configFiles['netlify.toml'] = this.generateNetlifyConfig(request);
        break;
      case 'aws':
        configFiles['aws-config.yml'] = this.generateAWSConfig(request);
        break;
      case 'cloudflare':
        configFiles['wrangler.toml'] = this.generateCloudflareConfig(request);
        break;
    }

    // Generate CI/CD pipeline
    const cicdPipeline = this.generateCICDPipeline(request);
    configFiles['.github/workflows/deploy.yml'] = cicdPipeline;

    // Generate environment file template
    configFiles['.env.example'] = this.generateEnvTemplate(request);

    // Generate README deployment section
    configFiles['DEPLOYMENT.md'] = this.generateDeploymentDocs(request);

    return {
      status: 'success',
      buildLogs: ['Configuration files generated', 'Ready for deployment'],
      configFiles,
      cicdPipeline,
    };
  }

  private generateVercelConfig(request: DeploymentRequest): string {
    return JSON.stringify(
      {
        version: 2,
        name: request.projectName,
        builds: [
          {
            src: 'package.json',
            use: '@vercel/node',
          },
        ],
        routes: [
          {
            src: '/(.*)',
            dest: '/',
          },
        ],
        env: request.envVars || {},
      },
      null,
      2
    );
  }

  private generateNetlifyConfig(request: DeploymentRequest): string {
    return `[build]
  command = "${request.buildCommand}"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

${request.envVars ? Object.entries(request.envVars).map(([key, val]) => `  ${key} = "${val}"`).join('\n') : ''}`;
  }

  private generateAWSConfig(request: DeploymentRequest): string {
    return `# AWS Elastic Beanstalk Configuration
version: 1
application: ${request.projectName}
deploy:
  artifact: dist.zip
environment:
  - name: ${request.environment}
    instance_type: t2.micro
    scaling:
      min: 1
      max: 4
`;
  }

  private generateCloudflareConfig(request: DeploymentRequest): string {
    return `name = "${request.projectName}"
type = "webpack"
account_id = "YOUR_ACCOUNT_ID"
workers_dev = ${request.environment === 'production' ? 'false' : 'true'}
route = ""
zone_id = ""

[build]
command = "${request.buildCommand}"

[build.upload]
format = "service-worker"
`;
  }

  private generateCICDPipeline(request: DeploymentRequest): string {
    return `name: Deploy to ${request.platform}

on:
  push:
    branches:
      - ${request.environment === 'production' ? 'main' : 'develop'}
  pull_request:
    branches:
      - ${request.environment === 'production' ? 'main' : 'develop'}

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Build project
        run: ${request.buildCommand}
        env:
${request.envVars ? Object.keys(request.envVars).map((key) => `          ${key}: \${{ secrets.${key} }}`).join('\n') : '          NODE_ENV: production'}
      
      - name: Deploy to ${request.platform}
        run: |
          echo "Deploying to ${request.platform}..."
          # Add platform-specific deploy command
        env:
          DEPLOY_TOKEN: \${{ secrets.DEPLOY_TOKEN }}
`;
  }

  private generateEnvTemplate(request: DeploymentRequest): string {
    const baseVars = {
      NODE_ENV: request.environment,
      PORT: '3000',
      API_BASE_URL: 'https://api.example.com',
    };

    const allVars = { ...baseVars, ...(request.envVars || {}) };

    return Object.entries(allVars)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
  }

  private generateDeploymentDocs(request: DeploymentRequest): string {
    return `# Deployment Guide: ${request.projectName}

## Platform: ${request.platform}
## Environment: ${request.environment}

## Prerequisites

- Node.js 20+
- ${request.platform} account
- Environment variables configured

## Deployment Steps

1. **Build the project**
   \`\`\`bash
   ${request.buildCommand}
   \`\`\`

2. **Configure environment variables**
   Copy \`.env.example\` to \`.env.${request.environment}\` and fill in values.

3. **Deploy**
   ${this.getDeployCommand(request.platform)}

## CI/CD

GitHub Actions workflow is configured in \`.github/workflows/deploy.yml\`.
Pushes to \`${request.environment === 'production' ? 'main' : 'develop'}\` branch trigger automatic deployment.

## Monitoring

- Logs: Check ${request.platform} dashboard
- Metrics: CPU, Memory, Request rate
- Alerts: Configure via ${request.platform} notifications

## Rollback

\`\`\`bash
# Rollback to previous version
${this.getRollbackCommand(request.platform)}
\`\`\`

## Support

For deployment issues, contact DevOps team or check logs in ${request.platform} dashboard.
`;
  }

  private getDeployCommand(platform: string): string {
    const commands: Record<string, string> = {
      vercel: '```bash\nnpx vercel --prod\n```',
      netlify: '```bash\nnetlify deploy --prod\n```',
      aws: '```bash\neb deploy\n```',
      cloudflare: '```bash\nwrangler publish\n```',
    };

    return commands[platform] || '```bash\n# Platform-specific deploy command\n```';
  }

  private getRollbackCommand(platform: string): string {
    const commands: Record<string, string> = {
      vercel: 'vercel rollback',
      netlify: 'netlify rollback',
      aws: 'eb deploy --version <previous-version>',
      cloudflare: 'wrangler rollback',
    };

    return commands[platform] || '# Platform-specific rollback command';
  }
}

