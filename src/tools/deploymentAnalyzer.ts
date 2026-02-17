
/**
 * Deployment Analyzer
 * 
 * Analyzes GitHub workflow failures:
 * 1. Parses error logs
 * 2. Identifies error type (build, test, lint, deploy)
 * 3. Extracts relevant context
 * 4. Generates fix prompt for Jules AI
 */

import { logInfo, logError } from '../utils/logger.js';

export type ErrorCategory = 'build' | 'test' | 'lint' | 'deploy' | 'deployment' | 'unknown';

export interface DeploymentAnalysis {
  type: ErrorCategory;
  summary: string;
  errorLocation?: {
    file: string;
    line?: number;
  };
  rawError: string;
  category: ErrorCategory;
  message: string;
  title: string;
  affectedFiles: string[];
  confidence: number;
  errors?: string[]; // Array of individual error messages
  suggestions?: string[]; // Suggested fixes
  errorCount?: number; // Number of errors found
}

export class DeploymentAnalyzer {
  /**
   * Analyzes CI/CD logs to identify the root cause of failure
   */
  static analyzeLogs(logs: string): DeploymentAnalysis {
    logInfo('DeploymentAnalyzer', 'Analyzing workflow logs');
    
    // 1. Detect error category
    const category = DeploymentAnalyzer.detectErrorCategory(logs);
    
    // 2. Extract error message
    const { title, message } = DeploymentAnalyzer.extractErrorMessage(logs);
    
    // 3. Extract location
    const errorLocation = DeploymentAnalyzer.extractErrorLocation(logs);
    
    // 4. Get affected files
    const affectedFiles = DeploymentAnalyzer.extractAffectedFiles(logs);
    
    // 5. Calculate confidence
    const confidence = DeploymentAnalyzer.calculateConfidence(category, errorLocation, message);

    // 6. Extract individual errors
    const errors = DeploymentAnalyzer.extractIndividualErrors(logs, category);

    // 7. Generate suggestions
    const suggestions = DeploymentAnalyzer.generateSuggestions(category, affectedFiles);

    logInfo('DeploymentAnalyzer', `Detected ${category} error with ${(confidence * 100).toFixed(0)}% confidence`);

    return {
      type: category,
      category,
      title,
      summary: message,
      message,
      errorLocation,
      rawError: logs.slice(0, 1000),
      affectedFiles,
      confidence,
      errors, // Individual error messages
      suggestions, // Suggested fixes
      errorCount: errors.length
    };
  }

  /**
   * Detect error category from log content
   */
  private static detectErrorCategory(logs: string): ErrorCategory {
    const patterns = {
      build: [
        /error TS\d+:/i,
        /SyntaxError/i,
        /failed to.*compile/i,
        /compilation failed/i,
        /module not found/i,
        /cannot find.*module/i
      ],
      test: [
        /test failed/i,
        /assertion.*failed/i,
        / failing( test)?/i,
        /mocha|jest|vitest/i,
        /expected.*to/i
      ],
      lint: [
        /eslint|prettier|stylelint/i,
        /linting.*failed/i,
        /✖/i
      ],
      deploy: [
        /deployment.*failed/i,
        /(push|pull|clone).*(failed|error)/i,
        /remote:.*error/i,
        /npm.*publish/i
      ]
    };

    for (const [category, categoryPatterns] of Object.entries(patterns)) {
      for (const pattern of categoryPatterns) {
        if (pattern.test(logs)) {
          return category as ErrorCategory;
        }
      }
    }
    return 'unknown';
  }

  /**
   * Extract error title and message from logs  
   */
  private static extractErrorMessage(logs: string): { title: string; message: string } {
    // 1. Check for TypeScript/Build errors
    if (logs.includes('error TS') || logs.includes('SyntaxError')) {
      const match = logs.match(/(?:error TS\d+:|SyntaxError:)(.+)/);
      const message = match ? match[1].trim() : 'Build failed with TypeScript errors';
      return { 
        title: 'Build Error', 
        message 
      };
    }

    // 2. Check for Test failures (Vitest/Jest)
    if (logs.includes('FAIL') || logs.includes('failing')) {
      return {
        title: 'Test Failed',
        message: 'Unit tests failed - see logs for details'
      };
    }

    // 3. Check for Lint errors (ESLint)
    if (logs.includes('eslint') || logs.includes('ESLint')) {
      return {
        title: 'Lint Error',
        message: 'Linting checks failed'
      };
    }

    // 4. Check for Deploy errors
    if (logs.includes('remote:') || logs.includes('push failed')) {
      return {
        title: 'Deployment Error',
        message: 'Deployment or git operation failed'
      };
    }

    // Default fallback
    return {
      title: 'Unknown Error',
      message: 'Unknown deployment error - see logs for details'
    };
  }

  /**
   * Extract error location (file and line number)
   */
  private static extractErrorLocation(logs: string): { file: string; line?: number } | undefined {
    // Match: file.ts:42:15 or file.ts(42,15)
    const match = logs.match(/([a-zA-Z0-9_/.-]+\.(?:ts|tsx|js|jsx|py))[:\(](\d+)/);
    if (match) {
      return {
        file: match[1],
        line: parseInt(match[2], 10)
      };
    }
    return undefined;
  }

  /**
   * Extract affected files from logs
   */
  private static extractAffectedFiles(logs: string): string[] {
    const files = new Set<string>();
    const filePattern = /(?:src|test|lib|app)\/[^\s:]+\.(?:ts|tsx|js|jsx|py|go|rs)/g;
    const matches = logs.match(filePattern);

    if (matches) {
      matches.forEach((match) => files.add(match));
    }

    return Array.from(files).slice(0, 5); // Top 5 files
  }

  /**
   * Calculate confidence score for the analysis
   */
  private static calculateConfidence(
    category: ErrorCategory,
    errorLocation: { file: string; line?: number } | undefined,
    message: string
  ): number {
    let score = 0.7; // Base score

    // Increase for clear categories
    if (category !== 'unknown') {
      score += 0.1;
    }

    // Increase if location found
    if (errorLocation) {
      score += 0.1;
    }

    // Decrease if message is vague
    if (message.includes('Unknown') || message.includes('unknown')) {
      score -= 0.1;
    }

    return Math.min(0.95, Math.max(0.3, score));
  }

  /**
   * Generates a prompt for Jules to fix the detected issue
   */
  static generateFixPrompt(analysis: DeploymentAnalysis, fileContent?: string): string {
    const basePrompt = `## Jules Continuous AI - Automated Fix Request

**Error Category:** ${analysis.category.toUpperCase()}  
**Title:** ${analysis.title}  
**Confidence:** ${(analysis.confidence * 100).toFixed(0)}%

### Error Summary
${analysis.message}

### Raw Error Logs
\`\`\`
${analysis.rawError}
\`\`\`

${analysis.affectedFiles.length > 0 ? `### Affected Files\n${analysis.affectedFiles.map((f) => `- \`${f}\``).join('\n')}\n` : ''}`;

    if (analysis.errorLocation) {
      return `${basePrompt}

### Error Location
**File:** ${analysis.errorLocation.file}  
${analysis.errorLocation.line ? `**Line:** ${analysis.errorLocation.line}` : ''}

${fileContent ? `### File Content\n\`\`\`typescript\n${fileContent}\n\`\`\`` : ''}

### Task
1. Analyze the error and context
2. Identify root cause
3. Generate minimal fix (code changes only)
4. Create clear commit message
5. Return complete code diff

### Requirements
- Must resolve the ${analysis.category} error
- Preserve existing functionality
- Follow project code style
- Minimum test coverage: 80%
- No breaking changes
`;
    }

    return `${basePrompt}

### Task
1. Analyze the raw error logs above
2. Identify the likely root cause
3. Suggest the specific file and changes needed to fix
4. Provide detailed fix instructions

This is an automated request from the Jules Continuous AI Integration (JCAI).
`;
  }

  /**
   * Extract individual error messages from logs
   */
  private static extractIndividualErrors(logs: string, category: ErrorCategory): string[] {
    const errors: string[] = [];
    const lines = logs.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Build errors
      if (category === 'build' && (trimmed.includes('[error]') || trimmed.includes('error'))) {
        errors.push(trimmed);
      }
      // Test errors
      else if (category === 'test' && (trimmed.includes('Expected') || trimmed.includes('Received'))) {
        errors.push(trimmed);
      }
      // Deployment errors
      else if (
        (category === 'deploy' || category === 'deployment') &&
        (trimmed.includes('[error]') || trimmed.includes('Error:'))
      ) {
        errors.push(trimmed);
      }

      if (errors.length >= 5) break; // Limit to 5 errors
    }

    return errors.length > 0 ? errors : [logs.split('\n')[0] || 'Unknown error'];
  }

  /**
   * Generate suggestions for fixing the error
   */
  private static generateSuggestions(category: ErrorCategory, affectedFiles: string[]): string[] {
    const suggestions: string[] = [];

    switch (category) {
      case 'build':
        suggestions.push('Check import statements and file paths');
        suggestions.push('Verify TypeScript configuration');
        suggestions.push('Ensure all dependencies are installed');
        break;

      case 'test':
        suggestions.push('Increase test timeout if needed');
        suggestions.push('Update mock data');
        suggestions.push('Review assertion logic');
        break;

      case 'lint':
        suggestions.push('Run eslint with --fix flag');
        suggestions.push('Check code formatting');
        suggestions.push('Verify style rules compliance');
        break;

      case 'deploy':
      case 'deployment':
        suggestions.push('Verify environment variables');
        suggestions.push('Check authentication credentials');
        suggestions.push('Review deployment configuration');
        break;

      default:
        suggestions.push('Review error logs carefully');
        suggestions.push('Check recent code changes');
        suggestions.push('Verify all dependencies are properly installed');
    }

    if (affectedFiles.length > 0) {
      suggestions.push(`Focus on: ${affectedFiles.slice(0, 3).join(', ')}`);
    }

    return suggestions;
  }
}
