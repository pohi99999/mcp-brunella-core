import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';

/**
 * Knowledge Document
 */
interface KnowledgeDocument {
  documentId: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  author: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isPublished: boolean;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  relatedDocuments: string[];
}

/**
 * Wiki Page
 */
interface WikiPage {
  pageId: string;
  title: string;
  slug: string;
  content: string;
  sections: Array<{ heading: string; content: string }>;
  lastEditor: string;
  lastEditedAt: Date;
  createdAt: Date;
  viewCount: number;
  editHistory: Array<{ editor: string; timestamp: Date; changesSummary: string }>;
  isArchived: boolean;
  tags: string[];
}

/**
 * Knowledge Graph Node
 */
interface KnowledgeNode {
  nodeId: string;
  title: string;
  type: 'concept' | 'procedure' | 'entity' | 'relationship';
  description: string;
  relatedNodes: string[];
  metadata: Record<string, unknown>;
}

/**
 * Knowledge Search Result
 */
interface SearchResult {
  documentId: string;
  title: string;
  snippet: string;
  relevanceScore: number; // 0-100
  category: string;
  type: 'document' | 'wiki' | 'faq';
}

/**
 * KnowledgeBuilder - Tudástár Építő
 * Manages knowledge base, documentation, wiki pages, and knowledge graphs
 */
export class KnowledgeBuilder implements IAgent {
  name = 'KnowledgeBuilder';
  role = 'Knowledge & Documentation Management';
  description =
    'Tudástár Építő - Dokumentáció kezelés, wiki oldalak, tudásgráf, keresés és kategorizálás';
  capabilities = [
    'document_creation',
    'wiki_management',
    'knowledge_graph',
    'content_search',
    'category_organization',
    'version_control',
    'feedback_aggregation'
  ];

  private knowledgeBase: Map<string, KnowledgeDocument> = new Map();
  private wikiPages: Map<string, WikiPage> = new Map();
  private knowledgeGraph: Map<string, KnowledgeNode> = new Map();
  private searchIndex: Map<string, string[]> = new Map();

  /**
   * Execute agent task
   */
  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    try {
      logInfo(this.name, `Feladat indítása: ${task.slice(0, 40)}...`);

      if (task.toLowerCase().includes('create') || task.toLowerCase().includes('hozz')) {
        return await this.createDocument(task, context);
      }

      if (task.toLowerCase().includes('wiki') || task.toLowerCase().includes('oldal')) {
        return await this.manageWiki(task, context);
      }

      if (task.toLowerCase().includes('search') || task.toLowerCase().includes('keres')) {
        return await this.searchKnowledge(task, context);
      }

      if (task.toLowerCase().includes('graph') || task.toLowerCase().includes('gráf')) {
        return await this.buildKnowledgeGraph(task, context);
      }

      // Default: search knowledge
      return await this.searchKnowledge(task, context);
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, error);
      return { status: 'error', error };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }

  /**
   * Create or update knowledge document
   */
  private async createDocument(task: string, _context?: unknown): Promise<AgentResponse> {
    logInfo(this.name, 'Tudásdokumentum létrehozása...');

    // Mock document creation
    const docCategories = ['procedures', 'best-practices', 'api-reference', 'troubleshooting'];
    const category = docCategories[Math.floor(Math.random() * docCategories.length)];

    const document: KnowledgeDocument = {
      documentId: `DOC-${Date.now()}`,
      title: this.extractTitle(task) || 'Új Tudásdokumentum',
      content: task.substring(0, 500),
      category,
      tags: ['important', 'new', category],
      author: 'System',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      isPublished: false,
      viewCount: 0,
      helpfulCount: 0,
      notHelpfulCount: 0,
      relatedDocuments: []
    };

    this.knowledgeBase.set(document.documentId, document);
    this.indexDocument(document);

    logInfo(this.name, `Dokumentum létrehozva: ${document.documentId} (${category})`);

    return {
      status: 'success',
      data: {
        documentId: document.documentId,
        title: document.title,
        category: document.category,
        tags: document.tags,
        version: document.version,
        status: 'draft',
        createdAt: document.createdAt,
        nextSteps: [
          'Review content for accuracy',
          'Add related documents',
          'Set appropriate tags',
          'Publish to knowledge base'
        ],
        estimatedReviewTime: '15 minutes',
        publishingChecklist: {
          contentComplete: true,
          tagsAdded: true,
          examplesIncluded: false,
          reviewed: false,
          approved: false
        }
      }
    };
  }

  /**
   * Manage wiki pages
   */
  private async manageWiki(_task: string, _context?: unknown): Promise<AgentResponse> {
    logInfo(this.name, 'Wiki oldalak kezelése...');

    // Create mock wiki pages
    const wikiPages: WikiPage[] = [
      {
        pageId: 'WIKI-001',
        title: 'Getting Started Guide',
        slug: 'getting-started',
        content: 'Welcome to our knowledge base...',
        sections: [
          { heading: 'Introduction', content: 'Overview of the system...' },
          { heading: 'Installation', content: 'Step-by-step installation guide...' },
          { heading: 'Configuration', content: 'Configuration options...' }
        ],
        lastEditor: 'Admin',
        lastEditedAt: new Date(),
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        viewCount: 1245,
        editHistory: [
          { editor: 'Admin', timestamp: new Date(), changesSummary: 'Initial creation' }
        ],
        isArchived: false,
        tags: ['getting-started', 'installation']
      },
      {
        pageId: 'WIKI-002',
        title: 'API Reference',
        slug: 'api-reference',
        content: 'Complete API documentation...',
        sections: [
          { heading: 'Authentication', content: 'API authentication methods...' },
          { heading: 'Endpoints', content: 'Available API endpoints...' },
          { heading: 'Response Codes', content: 'HTTP response codes...' }
        ],
        lastEditor: 'Developer',
        lastEditedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        viewCount: 3421,
        editHistory: [
          { editor: 'Developer', timestamp: new Date(), changesSummary: 'Updated endpoints' }
        ],
        isArchived: false,
        tags: ['api', 'technical', 'reference']
      }
    ];

    for (const page of wikiPages) {
      this.wikiPages.set(page.pageId, page);
      logInfo(this.name, `Wiki oldal feldolgozva: ${page.title} (${page.viewCount} megtekintés)`);
    }

    return {
      status: 'success',
      data: {
        totalWikiPages: this.wikiPages.size,
        pages: Array.from(this.wikiPages.values()).map(p => ({
          pageId: p.pageId,
          title: p.title,
          slug: p.slug,
          viewCount: p.viewCount,
          lastEdited: p.lastEditedAt,
          sectionCount: p.sections.length,
          archived: p.isArchived
        })),
        statistics: {
          totalPages: this.wikiPages.size,
          totalViews: Array.from(this.wikiPages.values()).reduce((sum, p) => sum + p.viewCount, 0),
          averageViewsPerPage: Math.round(
            Array.from(this.wikiPages.values()).reduce((sum, p) => sum + p.viewCount, 0) /
              this.wikiPages.size
          ),
          recentlyUpdated: Array.from(this.wikiPages.values())
            .sort((a, b) => b.lastEditedAt.getTime() - a.lastEditedAt.getTime())
            .slice(0, 3)
            .map(p => p.title)
        },
        recommendations: [
          'Create more comprehensive how-to guides',
          'Add examples to API reference',
          'Create video tutorials for complex topics',
          'Establish documentation review schedule'
        ]
      }
    };
  }

  /**
   * Search knowledge base
   */
  private async searchKnowledge(task: string, _context?: unknown): Promise<AgentResponse> {
    logInfo(this.name, 'Tudásbázis keresése...');

    const searchTerm = this.extractSearchTerm(task);
    const results: SearchResult[] = this.performSearch(searchTerm);

    logInfo(this.name, `${results.length} találat: "${searchTerm}"`);

    return {
      status: 'success',
      data: {
        searchTerm,
        resultCount: results.length,
        results: results.slice(0, 10).map(r => ({
          documentId: r.documentId,
          title: r.title,
          snippet: r.snippet,
          relevance: `${r.relevanceScore}%`,
          category: r.category,
          type: r.type
        })),
        categories: {
          document: results.filter(r => r.type === 'document').length,
          wiki: results.filter(r => r.type === 'wiki').length,
          faq: results.filter(r => r.type === 'faq').length
        },
        searchSuggestions: [
          'Refine search with category filters',
          'Use advanced search operators',
          'Check spelling and try alternative terms',
          'Browse by category instead'
        ],
        executionTime: `${Math.random() * 100 + 50}ms`
      }
    };
  }

  /**
   * Build and update knowledge graph
   */
  private async buildKnowledgeGraph(_task: string, _context?: unknown): Promise<AgentResponse> {
    logInfo(this.name, 'Tudásgráf építése...');

    // Create mock knowledge nodes
    const nodes: KnowledgeNode[] = [
      {
        nodeId: 'NODE-001',
        title: 'API Authentication',
        type: 'concept',
        description: 'Methods and protocols for API authentication',
        relatedNodes: ['NODE-002', 'NODE-003'],
        metadata: { complexity: 'medium', lastUpdated: new Date() }
      },
      {
        nodeId: 'NODE-002',
        title: 'OAuth 2.0',
        type: 'procedure',
        description: 'OAuth 2.0 implementation guide',
        relatedNodes: ['NODE-001', 'NODE-004'],
        metadata: { complexity: 'high', lastUpdated: new Date() }
      },
      {
        nodeId: 'NODE-003',
        title: 'JWT Tokens',
        type: 'concept',
        description: 'JSON Web Tokens for authentication',
        relatedNodes: ['NODE-001', 'NODE-005'],
        metadata: { complexity: 'medium', lastUpdated: new Date() }
      },
      {
        nodeId: 'NODE-004',
        title: 'Rate Limiting',
        type: 'procedure',
        description: 'Implementing rate limits on API endpoints',
        relatedNodes: ['NODE-002'],
        metadata: { complexity: 'medium', lastUpdated: new Date() }
      },
      {
        nodeId: 'NODE-005',
        title: 'Token Refresh',
        type: 'procedure',
        description: 'Handling token expiration and refresh',
        relatedNodes: ['NODE-003'],
        metadata: { complexity: 'low', lastUpdated: new Date() }
      }
    ];

    for (const node of nodes) {
      this.knowledgeGraph.set(node.nodeId, node);
      logInfo(this.name, `Gráf csomópont hozzáadva: ${node.title}`);
    }

    return {
      status: 'success',
      data: {
        totalNodes: this.knowledgeGraph.size,
        nodes: Array.from(this.knowledgeGraph.values()).map(n => ({
          nodeId: n.nodeId,
          title: n.title,
          type: n.type,
          relatedCount: n.relatedNodes.length
        })),
        graphStatistics: {
          nodeTypes: {
            concept: nodes.filter(n => n.type === 'concept').length,
            procedure: nodes.filter(n => n.type === 'procedure').length,
            entity: nodes.filter(n => n.type === 'entity').length,
            relationship: nodes.filter(n => n.type === 'relationship').length
          },
          totalConnections: nodes.reduce((sum, n) => sum + n.relatedNodes.length, 0),
          averageConnections: Math.round(
            nodes.reduce((sum, n) => sum + n.relatedNodes.length, 0) / nodes.length
          ),
          mostConnected: nodes
            .sort((a, b) => b.relatedNodes.length - a.relatedNodes.length)
            .slice(0, 3)
            .map(n => ({ title: n.title, connections: n.relatedNodes.length }))
        },
        navigationPaths: [
          'API Authentication → OAuth 2.0 → Rate Limiting',
          'API Authentication → JWT Tokens → Token Refresh',
          'API Authentication → Token Management'
        ]
      }
    };
  }

  /**
   * Extract title from task
   */
  private extractTitle(task: string): string {
    const words = task.split(' ').slice(0, 5);
    return words.join(' ') || 'Új Dokumentum';
  }

  /**
   * Extract search term from task
   */
  private extractSearchTerm(task: string): string {
    const match = task.match(/(?:for|about|on)\s+(.+)/i);
    return match ? match[1] : task;
  }

  /**
   * Index document for search
   */
  private indexDocument(doc: KnowledgeDocument): void {
    const words = doc.title.toLowerCase().split(/\s+/);
    for (const word of words) {
      if (!this.searchIndex.has(word)) {
        this.searchIndex.set(word, []);
      }
      this.searchIndex.get(word)?.push(doc.documentId);
    }
  }

  /**
   * Perform search on knowledge base
   */
  private performSearch(searchTerm: string): SearchResult[] {
    const results: SearchResult[] = [];

    // Mock search results
    const mockResults: SearchResult[] = [
      {
        documentId: 'DOC-001',
        title: 'How to Use APIs',
        snippet: `Learning how to use APIs efficiently...`,
        relevanceScore: 95,
        category: 'api-reference',
        type: 'document'
      },
      {
        documentId: 'DOC-002',
        title: 'API Best Practices',
        snippet: `Best practices for API development...`,
        relevanceScore: 88,
        category: 'best-practices',
        type: 'document'
      },
      {
        documentId: 'WIKI-001',
        title: 'API Reference Guide',
        snippet: `Complete API documentation and examples...`,
        relevanceScore: 85,
        category: 'api-reference',
        type: 'wiki'
      }
    ];

    for (const result of mockResults) {
      if (
        result.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        result.snippet.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        results.push(result);
      }
    }

    if (results.length === 0) {
      results.push(...mockResults.slice(0, 2));
    }

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }
}
