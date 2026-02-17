import { describe, it, expect, vi } from 'vitest';
import { DeploymentAnalyzer, DeploymentAnalysis } from '../src/tools/deploymentAnalyzer';

describe('DeploymentAnalyzer', () => {
  it('should detect TypeScript build errors', () => {
    const logs = `
      > app@1.0.0 build
      > tsc

      src/app.ts(10,15): error TS2304: Cannot find name 'foo'.
    `;

    const analysis = DeploymentAnalyzer.analyzeLogs(logs);
    
    expect(analysis.type).toBe('build');
    expect(analysis.summary).toContain('Cannot find name');
    expect(analysis.errorLocation).toEqual({
      file: 'src/app.ts',
      line: 10
    });
  });

  it('should detect syntax errors', () => {
    const logs = `
      /app/src/utils.js:5
      const x = ;
                ^
      SyntaxError: Unexpected token ';'
    `;

    const analysis = DeploymentAnalyzer.analyzeLogs(logs);

    expect(analysis.type).toBe('build');
    expect(analysis.summary).toContain('Unexpected token');
    expect(analysis.errorLocation).toEqual({
      file: '/app/src/utils.js',
      line: 5
    });
  });

  it('should detect test failures', () => {
    const logs = `
      FAIL src/components/Button.test.tsx
        Button component
          ✕ should render correctly (5ms)

      Expected: "Save"
      Received: "Submit"
    `;

    const analysis = DeploymentAnalyzer.analyzeLogs(logs);

    expect(analysis.type).toBe('test');
    expect(analysis.title).toBe('Test Failed');
    expect(analysis.summary).toContain('Unit tests failed');
  });

  it('should generate a valid fix prompt', () => {
    const analysis: DeploymentAnalysis = {
      type: 'build',
      category: 'build',
      title: 'Build Error',
      summary: "Cannot find name 'foo'",
      message: "Cannot find name 'foo'",
      errorLocation: {
        file: 'src/app.ts',
        line: 10
      },
      rawError: "error TS2304: Cannot find name 'foo'",
      affectedFiles: ['src/app.ts'],
      confidence: 0.9,
      errors: ["error TS2304: Cannot find name 'foo'"],
      suggestions: [],
      errorCount: 1
    };

    const prompt = DeploymentAnalyzer.generateFixPrompt(analysis, "console.log(foo);");
    
    expect(prompt).toContain('**Error Category:** BUILD');
    expect(prompt).toContain("Cannot find name 'foo'");
    expect(prompt).toContain('**File:** src/app.ts');
    expect(prompt).toContain('**Line:** 10');
  });
});
