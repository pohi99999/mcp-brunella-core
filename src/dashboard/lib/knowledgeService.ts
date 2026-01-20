import { mcpClient } from './mcpClient';

export class KnowledgeService {
    async semanticSearch(query: string): Promise<any[]> {
        try {
            const result = await mcpClient.callTool('knowledge_semantic_search', { query });
            if (result.content && result.content[0] && result.content[0].type === 'text') {
                 return JSON.parse(result.content[0].text);
            }
            return [];
        } catch (e) {
            console.error("RAG Search failed", e);
            throw e;
        }
    }
}

export const knowledgeService = new KnowledgeService();
