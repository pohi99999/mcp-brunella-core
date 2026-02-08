import { IAgent, AgentResponse } from './types.js';
import toml from 'toml';
import { generateResponse } from '../core/llm_client.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import { addDocumentToIndex } from '../utils/rag.js';

// Dynamic imports
let fs: typeof import('fs') | null = null;
let path: typeof import('path') | null = null;

async function ensureModules() {
    if (typeof process !== 'undefined' && process.versions?.node) {
        if (!fs) fs = (await import('fs')).default || await import('fs');
        if (!path) path = (await import('path')).default || await import('path');
    }
}

// Note: Constructor cannot be async, so we use a sync initializer pattern or checks
// However, DynamicAgent seems designed for Node usage. We will do best effort.

interface DynamicAgentConfig {
    name?: string;
    displayName?: string;
    description?: string;
    systemPrompt?: string;
    query?: string;
    tags?: string[];
    tomlPath?: string;
}

export class DynamicAgent implements IAgent {
    public name: string = 'DynamicAgent';
    public role: string = 'Dynamic Agent';
    public description: string = 'Dynamically configured agent';
    public capabilities: string[] = ['dynamic'];
    private systemPrompt: string = '';
    private queryTemplate: string = '${task}';

    constructor(configOrPath?: string | DynamicAgentConfig) {
        // Warning: This constructor assumes Node environment if configOrPath involves files
        // We can't await here, so we rely on fs being available or fail gracefully
        if (typeof process !== 'undefined' && process.versions?.node) {
            // Try to load modules synchronously if possible, or assume they will be loaded?
            // CommonJS require is synchronous.
            try {
                // @ts-ignore
                if (!fs && typeof require !== 'undefined') fs = require('fs');
                // @ts-ignore
                if (!path && typeof require !== 'undefined') path = require('path');
            } catch {}
        }

        if (!configOrPath) {
            return;
        }

        if (typeof configOrPath === 'string') {
            // Legacy: TOML file path
            try {
                if (fs) {
                    const content = fs.readFileSync(configOrPath, 'utf-8');
                    const config = toml.parse(content);
                    this.initFromConfig(config);
                } else {
                    logError('DynamicAgent', 'FileSystem not available');
                }
            } catch (error) {
                logError('DynamicAgent', `Failed to load TOML from ${configOrPath}: ${error}`);
            }
        } else {
            // New: Config object from registry
            this.initFromConfig(configOrPath);

            // If tomlPath is provided in config, also load from TOML
            if (configOrPath.tomlPath) {
                try {
                    if (fs) {
                        const content = fs.readFileSync(configOrPath.tomlPath, 'utf-8');
                        const tomlConfig = toml.parse(content);
                        this.initFromConfig({ ...configOrPath, ...tomlConfig });
                    }
                } catch (error) {
                    logError('DynamicAgent', `Failed to load TOML: ${error}`);
                }
            }
        }
    }

    private initFromConfig(config: DynamicAgentConfig): void {
        if (config.name) this.name = config.name;
        if (config.displayName) this.role = config.displayName;
        else if (config.name) this.role = config.name;
        if (config.description) this.description = config.description;
        if (config.systemPrompt) this.systemPrompt = config.systemPrompt;
        if (config.query) this.queryTemplate = config.query;
        if (config.tags) this.capabilities = config.tags;
    }

    async execute(task: string, context?: any): Promise<AgentResponse> {
        await ensureModules();

        const taskDesc = task.length > 80 ? task.slice(0, 77) + '...' : task;
        setAgentStatus(this.name, 'working', taskDesc);
        logInfo(this.name, `Executing task for ${this.name}: ${task}`);

        try {
            // Context enrichment for Project Organizer
            let contextData = "";
            if (this.name === 'project_organizer') {
                if (!fs || !path) throw new Error("FileSystem not available");

                const targetDir = context?.target_path || process.cwd();
                const files = fs.readdirSync(targetDir);
                
                // --- Proactive Indexing ---
                logInfo(this.name, `Project Organizer is indexing files in ${targetDir}`);
                for (const file of files) {
                    const fullPath = path.join(targetDir, file);
                    const stats = fs.statSync(fullPath);
                    // Only index relevant text files to save time
                    if (stats.isFile() && file.match(/\.(md|ts|js|json|txt)$/)) {
                        try {
                            const content = fs.readFileSync(fullPath, 'utf-8');
                            await addDocumentToIndex(file, content);
                        } catch (err) {
                            logError(this.name, `Failed to index ${file}: ${err}`);
                        }
                    }
                }
                
                contextData = `\n\nCurrent directory contents of '${targetDir}' (THESE ARE NOW INDEXED TO MEMORY):\n${files.join('\n')}`;
            }

            const prompt = `${this.queryTemplate.replace('${target_path}', context?.target_path || '.')} \n\nUser Message: ${task} \n${contextData}`;
            
            // Call the LLM
            const fullPrompt = `${this.systemPrompt}\n\n${prompt}`;
            const response = await generateResponse(fullPrompt, context?.provider);

            return {
                status: 'success',
                data: response
            };
        } catch (e: any) {
            logError(this.name, `Execution failed: ${e.message}`);
            return {
                status: 'error',
                error: e.message
            };
        } finally {
            setAgentStatus(this.name, 'idle');
        }
    }
}
