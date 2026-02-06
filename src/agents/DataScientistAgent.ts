import { IAgent, AgentResponse, ISwarmContext } from './types.js';
import { logInfo } from '../utils/logger.js';

export default class DataScientistAgent implements IAgent {
    name = 'DataScientist';
    description = 'Adatok elemzésére és Python kód futtatására specializálódott ügynök.';
    role = 'scientist';
    capabilities = ['data_analysis', 'python_execution'];

    async execute(task: string, context?: { swarm?: ISwarmContext }): Promise<AgentResponse> {

        // Check for shared artifacts from Researcher
        let dataToAnalyze = null;
        if (context?.swarm && context.swarm.artifacts['searchResults']) {
            dataToAnalyze = context.swarm.artifacts['searchResults'];
            logInfo('DataScientistAgent', `Loaded search results from Swarm Context.`);
        }

        if (task.toLowerCase().includes('elemz') || task.toLowerCase().includes('analyze')) {
            logInfo('DataScientistAgent', `Analyzing data...`);

            const analysis = {
                summary: 'Data analysis complete.',
                insight: 'The search results indicate a strong trend towards...' + (dataToAnalyze ? ' (based on ' + (dataToAnalyze as unknown[]).length + ' items)' : ''),
                timestamp: new Date().toISOString()
            };

            if (context?.swarm) {
                context.swarm.history.push({
                    role: 'assistant',
                    agent: this.name,
                    content: `Analysis complete: ${analysis.insight}`
                });
            }

            return {
                status: 'success',
                data: analysis
            };
        }

        return {
            status: 'error',
            error: 'Csak elemzési feladatokat vállalok.'
        };
    }
}