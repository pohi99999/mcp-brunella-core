/**
 * Unit tests for KnowledgeBaseBuilderAgent
 * Tests documentation generation, search, and LanceDB integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeBaseBuilderAgent } from '../src/agents/KnowledgeBaseBuilderAgent.js';

describe('KnowledgeBaseBuilderAgent', () => {
  let agent: KnowledgeBaseBuilderAgent;

  beforeEach(() => {
    agent = new KnowledgeBaseBuilderAgent();
  });

  describe('Agent Metadata', () => {
    it('should have correct name', () => {
      expect(agent.name).toBe('KnowledgeBaseBuilder');
    });

    it('should have correct capabilities', () => {
      expect(agent.capabilities).toContain('document_generation');
      expect(agent.capabilities).toContain('markdown_formatting');
      expect(agent.capabilities).toContain('vector_search');
      expect(agent.capabilities).toContain('auto_categorization');
    });
  });

  describe('Document Generation', () => {
    it('should generate documentation', async () => {
      const task = JSON.stringify({
        topic: 'API Usage Guide',
        sections: ['Introduction', 'Authentication', 'Endpoints'],
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.document).toBeDefined();
      expect(result.data.document).toHaveProperty('title');
      expect(result.data.document).toHaveProperty('content');
    });

    it('should support markdown formatting', async () => {
      const task = JSON.stringify({
        topic: 'Installation Guide',
        format: 'markdown',
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.document.format).toBe('markdown');
      expect(result.data.document.content).toContain('#');
    });
  });

  describe('Vector Search', () => {
    it('should search knowledge base', async () => {
      const task = JSON.stringify({
        query: 'How to configure authentication?',
        topK: 5,
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.searchResults).toBeDefined();
      expect(Array.isArray(result.data.searchResults)).toBe(true);
    });

    it('should return relevant results', async () => {
      const task = JSON.stringify({
        query: 'deployment process',
        topK: 3,
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.searchResults.length).toBeLessThanOrEqual(3);
      
      if (result.data.searchResults.length > 0) {
        expect(result.data.searchResults[0]).toHaveProperty('score');
        expect(result.data.searchResults[0]).toHaveProperty('content');
      }
    });
  });

  describe('Auto Categorization', () => {
    it('should categorize documents', async () => {
      const task = JSON.stringify({
        topic: 'Database Migration',
        content: 'Step-by-step guide for migrating from MySQL to PostgreSQL',
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.document.category).toBeDefined();
      expect(result.data.document.tags).toBeDefined();
      expect(Array.isArray(result.data.document.tags)).toBe(true);
    });
  });

  describe('LanceDB Integration', () => {
    it('should store documents in vector database', async () => {
      const task = JSON.stringify({
        topic: 'Performance Optimization',
        sections: ['Caching', 'Database Indexing', 'Load Balancing'],
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.vectorDbId).toBeDefined();
    });

    it('should support batch operations', async () => {
      const task = JSON.stringify({
        documents: [
          { topic: 'Doc1', content: 'Content 1' },
          { topic: 'Doc2', content: 'Content 2' },
        ],
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.batchResults).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle empty topic', async () => {
      const task = JSON.stringify({
        topic: '',
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
    });

    it('should handle search with no results', async () => {
      const task = JSON.stringify({
        query: 'completely nonexistent topic xyz123',
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.searchResults).toBeDefined();
    });
  });
});
