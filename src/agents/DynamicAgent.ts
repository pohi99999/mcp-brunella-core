import { IAgent, AgentResponse } from './types.js';
import fs from 'fs';
import path from 'path';
import toml from 'toml';
import { chatWithOllama } from '../core/llm_client.js';
import { Logger } from '../utils/logger.js';
import { addToIndex } from '../utils/rag.js';

export class DynamicAgent implements IAgent {
    public name: string;
    public role: string;
    public description: string;
    public capabilities: string[] = [];
    private systemPrompt: string;
    private queryTemplate: string;
    private logger: Logger;

    constructor(tomlPath: string) {
        this.logger = new Logger('agent-dynamic.log');
        const content = fs.readFileSync(tomlPath, 'utf-8');
        const config = toml.parse(content);

        this.name = config.name;
        this.role = config.displayName || config.name;
        this.description = config.description;
        this.systemPrompt = config.systemPrompt;
        this.queryTemplate = config.query;
        this.capabilities = config.tags || ['dynamic'];
    }

    async execute(task: string, context?: any): Promise<AgentResponse> {
        this.logger.info(`Executing task for ${this.name}: ${task}`);

        try {
            // Context enrichment for Project Organizer
            let contextData = "";
            if (this.name === 'project_organizer') {
                const targetDir = context?.target_path || process.cwd();
                const files = fs.readdirSync(targetDir);
                
                // --- Proactive Indexing ---
                this.logger.info(`Project Organizer is indexing files in ${targetDir}`);
                for (const file of files) {
                    const fullPath = path.join(targetDir, file);
                    const stats = fs.statSync(fullPath);
                    // Only index relevant text files to save time
                    if (stats.isFile() && file.match(/\.(md|ts|js|json|txt)$/)) {
                        try {
                            const content = fs.readFileSync(fullPath, 'utf-8');
                            await addToIndex(file, content);
                        } catch (err) {
                            this.logger.warn(`Failed to index ${file}: ${err}`);
                        }
                    }
                }
                
                contextData = `\nCurrent directory contents of '${targetDir}' (THESE ARE NOW INDEXED TO MEMORY):\n${files.join('\n')}`;
            }

            const prompt = `${this.queryTemplate.replace('${target_path}', context?.target_path || '.')} \n\nUser Message: ${task} \n${contextData}`;
            
            // Call the LLM
            const response = await chatWithOllama(prompt, this.systemPrompt);

            return {
                status: 'success',
                data: response
            };
        } catch (e: any) {
            this.logger.error(`Execution failed: ${e.message}`);
            return {
                status: 'error',
                error: e.message
            };
        }
    }
}