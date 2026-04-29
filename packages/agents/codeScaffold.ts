/**
 * Code Scaffolding Agent (P9)
 * Generates code from templates with variable replacement.
 * Supports built-in templates: React components, REST APIs, Agents, Test files.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { logInfo, logError, setAgentStatus } from '@packages/utils/logger.js';

// ==================== Types ====================

export type TemplateCategory = 'component' | 'api' | 'agent' | 'test' | 'generic';

export interface TemplateVariable {
    name: string;
    description: string;
    default?: string;
    required: boolean;
}

export interface TemplateFile {
    path: string; // Can contain {{variables}}
    content: string; // Can contain {{variables}}
}

export interface Template {
    name: string;
    description: string;
    category: TemplateCategory;
    variables: TemplateVariable[];
    files: TemplateFile[];
}

export interface GeneratedFile {
    path: string;
    content: string;
    preview: boolean;
}

export interface ScaffoldOptions {
    preview?: boolean; // If true, don't write files
    overwrite?: boolean; // If true, overwrite existing files
    workspaceRoot?: string;
}

// ==================== Built-in Templates ====================

const REACT_COMPONENT_TEMPLATE: Template = {
    name: 'react-component',
    description: 'React functional component with TypeScript and test',
    category: 'component',
    variables: [
        { name: 'ComponentName', description: 'Component name (PascalCase)', required: true },
        { name: 'description', description: 'Component description', required: false, default: 'Component description' },
    ],
    files: [
        {
            path: 'src/components/{{ComponentName}}.tsx',
            content: `/**
 * {{ComponentName}} Component
 * {{description}}
 */

import React from 'react';

interface {{ComponentName}}Props {
    className?: string;
}

export const {{ComponentName}}: React.FC<{{ComponentName}}Props> = ({ className }) => {
    return (
        <div className={className}>
            <h1>{{ComponentName}}</h1>
            <p>{{description}}</p>
        </div>
    );
};
`,
        },
        {
            path: 'test/components/{{ComponentName}}.test.tsx',
            content: `import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { {{ComponentName}} } from '../../src/components/{{ComponentName}}';

describe('{{ComponentName}}', () => {
    it('should render component', () => {
        render(<{{ComponentName}} />);
        expect(screen.getByText('{{ComponentName}}')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
        const { container } = render(<{{ComponentName}} className="custom-class" />);
        expect(container.firstChild).toHaveClass('custom-class');
    });
});
`,
        },
    ],
};

const REST_API_TEMPLATE: Template = {
    name: 'rest-api',
    description: 'Express REST API route with CRUD operations and tests',
    category: 'api',
    variables: [
        { name: 'routeName', description: 'Route name (kebab-case)', required: true },
        { name: 'ResourceName', description: 'Resource name (PascalCase)', required: true },
        { name: 'description', description: 'API description', required: false, default: 'API endpoint' },
    ],
    files: [
        {
            path: 'src/server/routes/{{routeName}}.ts',
            content: `/**
 * {{ResourceName}} API Routes
 * {{description}}
 */

import { Router } from 'express';
import { logInfo, logError } from '@packages/utils/logger.js';

const router = Router();

// GET /{{routeName}} - List all resources
router.get('/', async (req, res) => {
    try {
        logInfo('{{ResourceName}}API', 'Fetching all resources...');
        // TODO [tech-debt-cleanup]: Implement list logic
        res.json({ resources: [] });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError('{{ResourceName}}API', \`Failed to list resources: \${msg}\`);
        res.status(500).json({ error: msg });
    }
});

// GET /{{routeName}}/:id - Get single resource
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        logInfo('{{ResourceName}}API', \`Fetching resource: \${id}\`);
        // TODO [tech-debt-cleanup]: Implement get logic
        res.json({ resource: { id } });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError('{{ResourceName}}API', \`Failed to get resource: \${msg}\`);
        res.status(500).json({ error: msg });
    }
});

// POST /{{routeName}} - Create resource
router.post('/', async (req, res) => {
    try {
        logInfo('{{ResourceName}}API', 'Creating resource...');
        // TODO [tech-debt-cleanup]: Implement create logic
        res.status(201).json({ resource: { id: '1' } });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError('{{ResourceName}}API', \`Failed to create resource: \${msg}\`);
        res.status(500).json({ error: msg });
    }
});

// PUT /{{routeName}}/:id - Update resource
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        logInfo('{{ResourceName}}API', \`Updating resource: \${id}\`);
        // TODO [tech-debt-cleanup]: Implement update logic
        res.json({ resource: { id } });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError('{{ResourceName}}API', \`Failed to update resource: \${msg}\`);
        res.status(500).json({ error: msg });
    }
});

// DELETE /{{routeName}}/:id - Delete resource
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        logInfo('{{ResourceName}}API', \`Deleting resource: \${id}\`);
        // TODO [tech-debt-cleanup]: Implement delete logic
        res.status(204).send();
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError('{{ResourceName}}API', \`Failed to delete resource: \${msg}\`);
        res.status(500).json({ error: msg });
    }
});

export default router;
`,
        },
        {
            path: 'test/routes/{{routeName}}.test.ts',
            content: `import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import router from '../../src/server/routes/{{routeName}}.js';

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
    logInfo: vi.fn(),
    logError: vi.fn(),
}));

describe('{{ResourceName}} API Routes', () => {
    let app: express.Application;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/{{routeName}}', router);
    });

    it('GET / should list all resources', async () => {
        const response = await request(app).get('/{{routeName}}');
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('resources');
        expect(Array.isArray(response.body.resources)).toBe(true);
    });

    it('GET /:id should get single resource', async () => {
        const response = await request(app).get('/{{routeName}}/123');
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('resource');
        expect(response.body.resource.id).toBe('123');
    });

    it('POST / should create resource', async () => {
        const response = await request(app)
            .post('/{{routeName}}')
            .send({ name: 'Test' });
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('resource');
    });

    it('PUT /:id should update resource', async () => {
        const response = await request(app)
            .put('/{{routeName}}/123')
            .send({ name: 'Updated' });
        expect(response.status).toBe(200);
        expect(response.body.resource.id).toBe('123');
    });

    it('DELETE /:id should delete resource', async () => {
        const response = await request(app).delete('/{{routeName}}/123');
        expect(response.status).toBe(204);
    });
});
`,
        },
    ],
};

const AGENT_TEMPLATE: Template = {
    name: 'agent',
    description: 'AI Agent with IAgent interface implementation',
    category: 'agent',
    variables: [
        { name: 'AgentName', description: 'Agent name (PascalCase)', required: true },
        { name: 'agentRole', description: 'Agent role description', required: false, default: 'Agent role' },
        { name: 'description', description: 'Agent description', required: false, default: 'Agent description' },
    ],
    files: [
        {
            path: 'src/agents/{{AgentName}}.ts',
            content: `/**
 * {{AgentName}} Agent
 * {{description}}
 */

import { IAgent } from './types.js';
import { logInfo, logError, setAgentStatus } from '@packages/utils/logger.js';

export class {{AgentName}} implements IAgent {
    name = '{{AgentName}}';
    role = '{{agentRole}}';
    description = '{{description}}';
    capabilities = ['capability1', 'capability2'];

    async execute(task: string, context?: any): Promise<any> {
        setAgentStatus(this.name, 'working', task.slice(0, 50));
        logInfo(this.name, \`Executing task: \${task}\`);

        try {
            // TODO [tech-debt-cleanup]: Implement agent logic here
            const result = { success: true, message: 'Task completed' };

            logInfo(this.name, 'Task completed successfully');
            return { status: 'success', result };
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            logError(this.name, \`Task failed: \${msg}\`);
            return { status: 'error', error: msg };
        } finally {
            setAgentStatus(this.name, 'idle');
        }
    }
}
`,
        },
        {
            path: 'test/agents/{{AgentName}}.test.ts',
            content: `import { describe, it, expect, beforeEach, vi } from 'vitest';
import { {{AgentName}} } from '../../src/agents/{{AgentName}}.js';

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
    logInfo: vi.fn(),
    logError: vi.fn(),
    setAgentStatus: vi.fn(),
}));

describe('{{AgentName}} Agent', () => {
    let agent: {{AgentName}};

    beforeEach(() => {
        agent = new {{AgentName}}();
    });

    it('should have correct metadata', () => {
        expect(agent.name).toBe('{{AgentName}}');
        expect(agent.role).toBe('{{agentRole}}');
        expect(agent.description).toBe('{{description}}');
        expect(Array.isArray(agent.capabilities)).toBe(true);
    });

    it('should execute task successfully', async () => {
        const result = await agent.execute('test task');
        expect(result.status).toBe('success');
        expect(result).toHaveProperty('result');
    });

    it('should handle errors gracefully', async () => {
        // TODO [tech-debt-cleanup]: Add error test case
        expect(true).toBe(true);
    });
});
`,
        },
    ],
};

const TEST_FILE_TEMPLATE: Template = {
    name: 'test-file',
    description: 'Vitest test file boilerplate',
    category: 'test',
    variables: [
        { name: 'fileName', description: 'File name (kebab-case)', required: true },
        { name: 'TestSuite', description: 'Test suite name', required: true },
        { name: 'description', description: 'Test description', required: false, default: 'Test suite' },
    ],
    files: [
        {
            path: 'test/{{fileName}}.test.ts',
            content: `/**
 * {{TestSuite}} Tests
 * {{description}}
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('{{TestSuite}}', () => {
    beforeEach(() => {
        // Setup before each test
    });

    afterEach(() => {
        // Cleanup after each test
        vi.clearAllMocks();
    });

    it('should pass this sample test', () => {
        expect(true).toBe(true);
    });

    it('should handle basic operations', () => {
        // TODO [tech-debt-cleanup]: Implement test
        expect(1 + 1).toBe(2);
    });

    it('should handle edge cases', () => {
        // TODO [tech-debt-cleanup]: Implement test
        expect(true).toBe(true);
    });
});
`,
        },
    ],
};

const BUILT_IN_TEMPLATES: Template[] = [
    REACT_COMPONENT_TEMPLATE,
    REST_API_TEMPLATE,
    AGENT_TEMPLATE,
    TEST_FILE_TEMPLATE,
];

// ==================== TemplateEngine Class ====================

export class TemplateEngine {
    private templates: Map<string, Template>;
    private workspaceRoot: string;

    constructor(workspaceRoot?: string) {
        this.workspaceRoot = workspaceRoot || process.env.BRUNELLA_WORKSPACE_ROOT || process.cwd();
        this.templates = new Map();

        // Load built-in templates
        for (const template of BUILT_IN_TEMPLATES) {
            this.templates.set(template.name, template);
        }

        logInfo('TemplateEngine', `Initialized with ${this.templates.size} templates`);
    }

    /**
     * List all available templates.
     */
    listTemplates(): Template[] {
        return Array.from(this.templates.values());
    }

    /**
     * Get a specific template by name.
     */
    getTemplate(name: string): Template | null {
        return this.templates.get(name) || null;
    }

    /**
     * Replace variables in a string with provided values.
     * Supports {{variableName}} syntax.
     */
    private replaceVariables(content: string, variables: Record<string, string>): string {
        let result = content;
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            result = result.replace(regex, value);
        }
        return result;
    }

    /**
     * Validate that all required variables are provided.
     */
    private validateVariables(template: Template, variables: Record<string, string>): void {
        for (const variable of template.variables) {
            if (variable.required && !variables[variable.name]) {
                throw new Error(`Required variable missing: ${variable.name}`);
            }
        }
    }

    /**
     * Apply default values to missing variables.
     */
    private applyDefaults(template: Template, variables: Record<string, string>): Record<string, string> {
        const result = { ...variables };
        for (const variable of template.variables) {
            if (!result[variable.name] && variable.default) {
                result[variable.name] = variable.default;
            }
        }
        return result;
    }

    /**
     * Generate files from a template (preview or actual).
     */
    async generateFromTemplate(
        templateName: string,
        variables: Record<string, string>,
        options: ScaffoldOptions = {}
    ): Promise<GeneratedFile[]> {
        const template = this.getTemplate(templateName);
        if (!template) {
            throw new Error(`Template not found: ${templateName}`);
        }

        // Validate and apply defaults
        this.validateVariables(template, variables);
        const finalVariables = this.applyDefaults(template, variables);

        logInfo('TemplateEngine', `Generating from template: ${templateName}`);

        const generatedFiles: GeneratedFile[] = [];

        for (const file of template.files) {
            const filePath = this.replaceVariables(file.path, finalVariables);
            const fileContent = this.replaceVariables(file.content, finalVariables);

            generatedFiles.push({
                path: filePath,
                content: fileContent,
                preview: options.preview || false,
            });

            // Write file if not preview mode
            if (!options.preview) {
                await this.writeFile(filePath, fileContent, options.overwrite || false);
            }
        }

        logInfo('TemplateEngine', `Generated ${generatedFiles.length} files from template: ${templateName}`);
        return generatedFiles;
    }

    /**
     * Preview generation without writing files.
     */
    async previewGeneration(
        templateName: string,
        variables: Record<string, string>
    ): Promise<GeneratedFile[]> {
        return this.generateFromTemplate(templateName, variables, { preview: true });
    }

    /**
     * Write a file to the filesystem.
     */
    private async writeFile(relativePath: string, content: string, overwrite: boolean): Promise<void> {
        const fullPath = path.join(this.workspaceRoot, relativePath);
        const dirPath = path.dirname(fullPath);

        // Check if file exists
        const fileExists = await fs.access(fullPath).then(() => true).catch(() => false);
        if (fileExists && !overwrite) {
            throw new Error(`File already exists and overwrite is false: ${relativePath}`);
        }

        // Create directory if it doesn't exist
        await fs.mkdir(dirPath, { recursive: true });

        // Write file
        await fs.writeFile(fullPath, content, 'utf-8');
        logInfo('TemplateEngine', `File written: ${relativePath}`);
    }

    /**
     * Add a custom template to the engine.
     */
    addTemplate(template: Template): void {
        this.templates.set(template.name, template);
        logInfo('TemplateEngine', `Template added: ${template.name}`);
    }
}

// ==================== Singleton ====================

let templateEngineInstance: TemplateEngine | null = null;

export function getTemplateEngine(workspaceRoot?: string): TemplateEngine {
    if (!templateEngineInstance) {
        templateEngineInstance = new TemplateEngine(workspaceRoot);
    }
    return templateEngineInstance;
}

