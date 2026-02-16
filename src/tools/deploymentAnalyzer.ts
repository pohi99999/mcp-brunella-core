
export interface DeploymentAnalysis {
  type: 'build' | 'test' | 'lint' | 'deploy' | 'unknown';
  summary: string;
  errorLocation?: {
    file: string;
    line?: number;
  };
  rawError: string;
}

export class DeploymentAnalyzer {
  /**
   * Analyzes CI/CD logs to identify the root cause of failure
   */
  static analyzeLogs(logs: string): DeploymentAnalysis {
    // 1. Check for TypeScript/Build errors
    if (logs.includes('error TS') || logs.includes('SyntaxError')) {
      const match = logs.match(/(?:error TS\d+:|SyntaxError:)(.+)/);
      const fileMatch = logs.match(/([a-zA-Z0-9_/.-]+\.tsx?)\((\d+),(\d+)\)/); // file.ts(1,1)
      
      return {
        type: 'build',
        summary: match ? match[1].trim() : 'Build failed with TypeScript errors',
        errorLocation: fileMatch ? {
          file: fileMatch[1],
          line: parseInt(fileMatch[2])
        } : undefined,
        rawError: match ? match[0] : logs.slice(0, 500)
      };
    }

    // 2. Check for Test failures (Vitest/Jest)
    if (logs.includes('FAIL') && (logs.includes('Test') || logs.includes('expect'))) {
      const failedTestMatch = logs.match(/×\s+(.+)/); // × test name
      return {
        type: 'test',
        summary: failedTestMatch ? `Test failed: ${failedTestMatch[1]}` : 'Unit tests failed',
        rawError: logs.slice(0, 1000) // Keep readable chunk
      };
    }

    // 3. Check for Lint errors (ESLint)
    if (logs.includes('eslint') && (logs.includes('error') || logs.includes('warning'))) {
      return {
        type: 'lint',
        summary: 'Linting checks failed',
        rawError: logs.slice(0, 500)
      };
    }

    // Default fallback
    return {
      type: 'unknown',
      summary: 'Unknown deployment error',
      rawError: logs.slice(0, 500)
    };
  }

  /**
   * Generates a prompt for Jules to fix the detected issue
   */
  static generateFixPrompt(analysis: DeploymentAnalysis, fileContent?: string): string {
    const basePrompt = `
You are an expert DevOps and Software Engineer. The automated build/deployment pipeline has failed.
I need you to fix the code based on the error analysis below.

ERROR TYPE: ${analysis.type.toUpperCase()}
SUMMARY: ${analysis.summary}

RAW ERROR LOGS:
\`\`\`
${analysis.rawError}
\`\`\`
`;

    if (analysis.errorLocation && fileContent) {
      return `${basePrompt}

ERROR LOCATION: ${analysis.errorLocation.file} (Line ${analysis.errorLocation.line})

FILE CONTENT:
\`\`\`typescript
${fileContent}
\`\`\`

INSTRUCTIONS:
1. Analyze the error and the file content.
2. Provide the corrected code.
3. Explain why the fix is necessary.
`;
    }

    return `${basePrompt}

INSTRUCTIONS:
1. Analyze the raw error logs.
2. Identify the likely file causing the issue.
3. Suggest a fix or describing what needs to be changed.
`;
  }
}
