/**
 * ArchitectAgent - Rendszerarchitektúra tervezés és SystemBlueprint generálás
 * Software Genesis Protocol része
 */

import { IAgent, AgentResponse, ISwarmContext } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import { generateResponse } from '../core/llm_client.js';

export interface GenesisRequest {
  originalIdea: string;
  clarifiedSpecs: {
    platform: 'web' | 'mobile_react_native' | 'electron';
    coreFeatures: string[];
    uiStyle: 'modern' | 'minimalist' | 'corporate';
    backendType: 'firebase' | 'node_custom' | 'supabase';
    constraints: string[];
  };
  status: 'idea' | 'defining' | 'architecting' | 'coding' | 'testing' | 'deployed';
}

export interface SystemBlueprint {
  techStack: {
    language: string;
    frameworks: string[];
    database: string;
    thirdPartyAPIs: string[];
  };
  architectureDiagram: string;
  fileStructure: string[];
  modules: ModuleDefinition[];
}

export interface ModuleDefinition {
  id: string;
  type: 'backend' | 'frontend_ui' | 'logic';
  assignedAgent: 'Developer' | 'UXDesigner';
  dependencies: string[];
  prompt: string;
  acceptanceCriteria: string[];
}

export default class ArchitectAgent implements IAgent {
  name = 'Architect';
  description =
    'Rendszerarchitektúra tervezés - SystemBlueprint, tech stack és modul definíciók generálása';
  role = 'architect';
  capabilities = [
    'architecture_design',
    'tech_stack_selection',
    'module_decomposition',
    'dependency_mapping',
    'blueprint_generation',
  ];

  async execute(
    task: string,
    context?: { swarm?: ISwarmContext }
  ): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));

    try {
      logInfo(this.name, `Architecture design task: ${task}`);

      // Parse GenesisRequest
      const request = this.parseRequest(task, context);

      // Validate
      if (!request.clarifiedSpecs || request.clarifiedSpecs.coreFeatures.length === 0) {
        return {
          status: 'error',
          error: 'GenesisRequest must have clarifiedSpecs with core features',
        };
      }

      logInfo(
        this.name,
        `Designing architecture for ${request.clarifiedSpecs.platform} app with ${request.clarifiedSpecs.coreFeatures.length} features`
      );

      // Generate SystemBlueprint
      const blueprint = await this.generateBlueprint(request);

      logInfo(
        this.name,
        `Blueprint generated: ${blueprint.modules.length} modules, ${blueprint.techStack.frameworks.length} frameworks`
      );

      return {
        status: 'success',
        data: blueprint,
        handoff: {
          type: 'handoff',
          targetAgent: 'specwriter',
          instruction: 'Break down modules into detailed task definitions',
          reason: 'SystemBlueprint complete, ready for task engineering',
        },
      };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, `Architecture design failed: ${error}`);
      return {
        status: 'error',
        error: `Architecture design failed: ${error}`,
      };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }

  private parseRequest(task: string, context?: { swarm?: ISwarmContext }): GenesisRequest {
    if (context?.swarm?.artifacts?.['genesisRequest']) {
      return context.swarm.artifacts['genesisRequest'] as GenesisRequest;
    }

    // Fallback: extract from task
    return {
      originalIdea: task,
      clarifiedSpecs: {
        platform: 'web',
        coreFeatures: ['feature1', 'feature2'],
        uiStyle: 'modern',
        backendType: 'node_custom',
        constraints: [],
      },
      status: 'architecting',
    };
  }

  private async generateBlueprint(request: GenesisRequest): Promise<SystemBlueprint> {
    const { platform, backendType, coreFeatures } = request.clarifiedSpecs;

    // Select tech stack based on specs
    const techStack = this.selectTechStack(platform, backendType);

    // Generate architecture diagram
    const architectureDiagram = this.generateArchitectureDiagram(techStack, coreFeatures);

    // Generate file structure
    const fileStructure = this.generateFileStructure(platform, techStack);

    // Decompose into modules
    const modules = await this.decomposeModules(request, techStack);

    return {
      techStack,
      architectureDiagram,
      fileStructure,
      modules,
    };
  }

  private selectTechStack(
    platform: string,
    backendType: string
  ): SystemBlueprint['techStack'] {
    const stacks: Record<string, SystemBlueprint['techStack']> = {
      web: {
        language: 'TypeScript',
        frameworks: ['React', 'Vite', 'Express'],
        database: backendType === 'firebase' ? 'Firestore' : 'PostgreSQL',
        thirdPartyAPIs: [],
      },
      mobile_react_native: {
        language: 'TypeScript',
        frameworks: ['React Native', 'Expo'],
        database: backendType === 'firebase' ? 'Firestore' : 'Supabase',
        thirdPartyAPIs: [],
      },
      electron: {
        language: 'TypeScript',
        frameworks: ['Electron', 'React', 'Vite'],
        database: 'SQLite',
        thirdPartyAPIs: [],
      },
    };

    return stacks[platform] || stacks['web'];
  }

  private generateArchitectureDiagram(
    techStack: SystemBlueprint['techStack'],
    features: string[]
  ): string {
    return `
# System Architecture

\`\`\`
┌─────────────────────────────────────┐
│     Frontend (${techStack.frameworks[0]})     │
├─────────────────────────────────────┤
│  - UI Components                    │
│  - State Management                 │
│  - API Client                       │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      Backend (${techStack.frameworks[2] || 'API'})        │
├─────────────────────────────────────┤
│  - REST API Endpoints               │
│  - Business Logic                   │
│  - Authentication                   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      Database (${techStack.database})       │
└─────────────────────────────────────┘

Core Features:
${features.map((f, i) => `${i + 1}. ${f}`).join('\n')}
\`\`\`
`.trim();
  }

  private generateFileStructure(
    platform: string,
    techStack: SystemBlueprint['techStack']
  ): string[] {
    const structures: Record<string, string[]> = {
      web: [
        'src/app.ts',
        'src/components/',
        'src/pages/',
        'src/api/',
        'src/utils/',
        'src/types/',
        'server/index.ts',
        'server/routes/',
        'server/middleware/',
        'server/db/',
        'package.json',
        'tsconfig.json',
        'vite.config.ts',
      ],
      mobile_react_native: [
        'src/App.tsx',
        'src/screens/',
        'src/components/',
        'src/navigation/',
        'src/services/',
        'src/utils/',
        'app.json',
        'package.json',
        'tsconfig.json',
      ],
      electron: [
        'src/main.ts',
        'src/renderer/',
        'src/preload.ts',
        'src/components/',
        'src/pages/',
        'package.json',
        'electron-builder.json',
      ],
    };

    return structures[platform] || structures['web'];
  }

  private async decomposeModules(
    request: GenesisRequest,
    techStack: SystemBlueprint['techStack']
  ): Promise<ModuleDefinition[]> {
    const modules: ModuleDefinition[] = [];
    const { coreFeatures } = request.clarifiedSpecs;

    // Frontend modules
    for (let i = 0; i < coreFeatures.length; i++) {
      modules.push({
        id: `module_frontend_${i + 1}`,
        type: 'frontend_ui',
        assignedAgent: 'UXDesigner',
        dependencies: [],
        prompt: `Create UI component for "${coreFeatures[i]}" using ${techStack.frameworks[0]}`,
        acceptanceCriteria: [
          'Component renders correctly',
          'Responsive design',
          'Accessibility compliance',
        ],
      });
    }

    // Backend modules
    for (let i = 0; i < coreFeatures.length; i++) {
      modules.push({
        id: `module_backend_${i + 1}`,
        type: 'backend',
        assignedAgent: 'Developer',
        dependencies: [`module_frontend_${i + 1}`],
        prompt: `Implement backend API for "${coreFeatures[i]}" using ${techStack.frameworks[2] || 'Express'}`,
        acceptanceCriteria: [
          'API endpoint functional',
          'Input validation',
          'Error handling',
          'Unit tests pass',
        ],
      });
    }

    return modules;
  }
}
