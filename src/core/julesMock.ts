/**
 * JCAI Phase 3 - Jules AI Mock for Testing
 *
 * Simulates Jules AI responses without needing actual Jules instance
 * Used for E2E testing, local development, and verification
 *
 * Environment Variables:
 * - JULES_MOCK_MODE=true       // Enable mock mode
 * - JULES_API_URL              // Real API URL (overrides mock)
 * - JULES_RESPONSE_DELAY=1000  // Simulate network latency
 */

import { logInfo, logWarn } from '../utils/logger.js';
import type { DeploymentAnalysis } from '../tools/deploymentAnalyzer.js';

export interface JulesFixResponse {
  status: 'success' | 'error' | 'partial';
  fixes: FixSuggestion[];
  explanation: string;
  confidence: number;
  testSuggestions?: string[];
  error?: string;
  timestamp: string;
}

export interface FixSuggestion {
  file: string;
  change: string;
  location: string;
  reason: string;
  diffHunk?: string;
}

/**
 * Mock responses for different error categories
 */
const mockResponses: Record<string, JulesFixResponse> = {
  // **BUILD ERRORS**
  build_missing_import: {
    status: 'success',
    fixes: [
      {
        file: 'src/build.ts',
        change: "import { exec } from 'child_process';",
        location: 'line 1',
        reason: 'Missing import for exec function',
        diffHunk: `+import { exec } from 'child_process';`
      }
    ],
    explanation: 'The error occurs because exec is not imported from child_process. Adding the import statement will resolve the build failure.',
    confidence: 0.98,
    timestamp: new Date().toISOString()
  },

  build_type_error: {
    status: 'success',
    fixes: [
      {
        file: 'src/server/routes/api.ts',
        change: 'interface RequestQuery extends Record<string, unknown> {}',
        location: 'line 12',
        reason: 'Type declaration for API query parameters',
        diffHunk: `+interface RequestQuery extends Record<string, unknown> {}`
      },
      {
        file: 'src/server/routes/api.ts',
        change: 'const query = req.query as RequestQuery;',
        location: 'line 45',
        reason: 'Type assertion to prevent implicit any',
        diffHunk: `+const query = req.query as RequestQuery;`
      }
    ],
    explanation: 'TypeScript strict mode requires explicit type definitions. Adding proper interfaces solves type errors.',
    confidence: 0.95,
    testSuggestions: ['npm run build'],
    timestamp: new Date().toISOString()
  },

  // **TEST FAILURES**
  test_timeout: {
    status: 'success',
    fixes: [
      {
        file: 'test/integration/api.test.ts',
        change: "it('should handle large files', async () => { pass: true });",
        location: 'line 42',
        reason: 'Increase test timeout from 5000ms to 10000ms',
        diffHunk: '-  it(\'should handle large files\', async () => {\n+ it(\'should handle large files\', async () => { return Promise.resolve(); });'
      }
    ],
    explanation: 'The test is timing out because large file processing takes longer than 5 seconds. Increasing the timeout threshold resolves this.',
    confidence: 0.92,
    testSuggestions: ['npm test -- --testTimeout=10000', 'npm test api.test.ts'],
    timestamp: new Date().toISOString()
  },

  test_assertion_failed: {
    status: 'success',
    fixes: [
      {
        file: 'test/utils/parser.test.ts',
        change:
          'expect(parser.parse(input)).toEqual({ name: "test", value: 123 });',
        location: 'line 28',
        reason: 'Update mock data to match expected output',
        diffHunk: `const expectedOutput = { name: "test", value: 123, active: true };`
      }
    ],
    explanation: 'The test assertion expects additional fields in the output. Updating mock data or parser logic fixes this.',
    confidence: 0.88,
    testSuggestions: ['npm test parser.test.ts'],
    timestamp: new Date().toISOString()
  },

  // **DEPLOYMENT ERRORS**
  deployment_auth_failed: {
    status: 'success',
    fixes: [
      {
        file: '.env.example',
        change: 'CLOUDFLARE_API_TOKEN=your_token_here',
        location: 'line 15',
        reason: 'Document required environment variable',
        diffHunk: '+CLOUDFLARE_API_TOKEN=your_token_here'
      },
      {
        file: 'src/deploy.ts',
        change: 'const token = process.env.CLOUDFLARE_API_TOKEN;\\nif (!token) throw new Error("Missing CLOUDFLARE_API_TOKEN");',
        location: 'line 20',
        reason: 'Add validation and clear error message',
        diffHunk: '+const token = process.env.CLOUDFLARE_API_TOKEN;\\n+if (!token) throw new Error("Missing CLOUDFLARE_API_TOKEN");'
      }
    ],
    explanation: 'Authentication failed because the API token environment variable is not set. Check .env file and ensure credentials are valid.',
    confidence: 0.96,
    testSuggestions: ['Check .env file', 'Verify CLOUDFLARE_API_TOKEN is set', 'npm run deploy'],
    timestamp: new Date().toISOString()
  },

  deployment_resource_limit: {
    status: 'success',
    fixes: [
      {
        file: 'wrangler.toml',
        change: '[env.production]\nname = "brunella-prod-optimized"',
        location: 'line 35',
        reason: 'Reduce bundle size and optimize resources',
        diffHunk: '+[env.production]\\n+name = "brunella-prod-optimized"'
      },
      {
        file: 'src/worker.ts',
        change: 'const unused = require(\"heavy-library\"); // Remove or lazy-load',
        location: 'line 12',
        reason: 'Remove unused dependencies from deployment bundle',
        diffHunk: `-const unused = require("heavy-library");`
      }
    ],
    explanation: 'Deployment failed because the bundle exceeds CloudFlare Workers size limit (1MB). Removing unused dependencies solves this.',
    confidence: 0.94,
    testSuggestions: ['Analyze bundle size', 'npm run build:analyze', 'npm run deploy'],
    timestamp: new Date().toISOString()
  },

  // **UNKNOWN/AMBIGUOUS ERRORS**
  unknown_error: {
    status: 'partial',
    fixes: [
      {
        file: 'src/error-handling.ts',
        change: 'console.error("Detailed error context:", error);',
        location: 'line 50',
        reason: 'Improve error logging for better diagnosis',
        diffHunk: `+console.error("Detailed error context:", error);`
      }
    ],
    explanation:
      'Error analysis is inconclusive due to limited log information. Adding more detailed error logging will help diagnose this issue.',
    confidence: 0.72,
    testSuggestions: ['npm run dev', 'Check console logs', 'Enable DEBUG mode'],
    timestamp: new Date().toISOString()
  }
};

/**
 * Select appropriate mock response based on error analysis
 */
function selectMockResponse(analysis: DeploymentAnalysis): JulesFixResponse {
  const { category, errors, summary } = analysis;

  // Map error patterns to mock responses
  if (category === 'build') {
    if (summary.includes('Cannot read property') || summary.includes('import')) {
      return mockResponses.build_missing_import;
    }
    if (summary.includes('Type') || summary.includes('type')) {
      return mockResponses.build_type_error;
    }
    return mockResponses.build_missing_import; // Default build fix
  }

  if (category === 'test') {
    if (summary.includes('timeout') || summary.includes('Timeout')) {
      return mockResponses.test_timeout;
    }
    if (summary.includes('Expected') || summary.includes('Received')) {
      return mockResponses.test_assertion_failed;
    }
    return mockResponses.test_assertion_failed; // Default test fix
  }

  if (category === 'deployment') {
    if (summary.includes('401') || summary.includes('Unauthorized') || summary.includes('Auth')) {
      return mockResponses.deployment_auth_failed;
    }
    if (summary.includes('limit') || summary.includes('size') || summary.includes('Size')) {
      return mockResponses.deployment_resource_limit;
    }
    return mockResponses.deployment_auth_failed; // Default deployment fix
  }

  // Fallback for unknown errors
  return mockResponses.unknown_error;
}

/**
 * Jules AI Client with Mock Support
 */
export class JulesAICoreClient {
  private useMock: boolean;
  private apiUrl: string;
  private responseDelay: number;

  constructor() {
    this.useMock = process.env.JULES_MOCK_MODE !== 'false';
    this.apiUrl = process.env.JULES_API_URL || '';
    this.responseDelay = parseInt(process.env.JULES_RESPONSE_DELAY || '1000', 10);
  }

  /**
   * Call Jules AI with error context
   */
  async generateFix(analysis: DeploymentAnalysis): Promise<JulesFixResponse> {
    if (!this.useMock || !this.apiUrl) {
      return this.getMockResponse(analysis);
    }

    try {
      logInfo('JulesAI', `📡 Calling Jules AI API: ${this.apiUrl}`);
      return await this.callRemoteJulesAPI(analysis);
    } catch (error) {
      logWarn(
        'JulesAI',
        `Network error calling Jules AI, falling back to mock: ${error instanceof Error ? error.message : String(error)}`
      );
      return this.getMockResponse(analysis);
    }
  }

  /**
   * Get mock response (local mode)
   */
  private async getMockResponse(analysis: DeploymentAnalysis): Promise<JulesFixResponse> {
    logInfo(
      'JulesAI',
      `🎭 Using mock response (JULES_MOCK_MODE=true) - Error category: ${analysis.category}`
    );

    // Simulate network latency
    await new Promise((resolve) => setTimeout(resolve, this.responseDelay));

    const response = selectMockResponse(analysis);

    logInfo(
      'JulesAI',
      `✅ Mock response generated (${response.fixes.length} fixes, confidence: ${(response.confidence * 100).toFixed(0)}%)`
    );

    return response;
  }

  /**
   * Call real Jules AI API (Phase 3.3.2)
   */
  private async callRemoteJulesAPI(analysis: DeploymentAnalysis): Promise<JulesFixResponse> {
    const response = await fetch(`${this.apiUrl}/v1/generate-fix`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.JULES_API_KEY}`
      },
      body: JSON.stringify({
        errorCategory: analysis.category,
        errorContext: {
          errors: analysis.errors,
          summary: analysis.summary,
          suggestions: analysis.suggestions,
          confidence: analysis.confidence
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Jules API error: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as JulesFixResponse;
  }

  /**
   * Validate fix response structure
   */
  validateResponse(response: JulesFixResponse): boolean {
    if (response.status !== 'success' && response.status !== 'error' && response.status !== 'partial') {
      return false;
    }
    if (!Array.isArray(response.fixes)) {
      return false;
    }
    if (typeof response.explanation !== 'string') {
      return false;
    }
    if (typeof response.confidence !== 'number' || response.confidence < 0 || response.confidence > 1) {
      return false;
    }
    return true;
  }
}

/**
 * Convenience function for single-shot usage
 */
export async function generateJulesFix(analysis: DeploymentAnalysis): Promise<JulesFixResponse> {
  const client = new JulesAICoreClient();
  const response = await client.generateFix(analysis);

  if (!client.validateResponse(response)) {
    throw new Error('Invalid Jules AI response format');
  }

  return response;
}

/**
 * Export all mock responses for testing
 */
export function getAllMockResponses() {
  return mockResponses;
}

/**
 * Get specific mock response by key
 */
export function getMockResponse(key: string): JulesFixResponse | undefined {
  return mockResponses[key as keyof typeof mockResponses];
}


