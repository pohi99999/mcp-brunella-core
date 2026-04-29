import { describe, it, expect } from 'vitest';
import { DeploymentAnalyzer, DeploymentAnalysis } from '@packages/utils/deploymentAnalyzer.js';

describe('DeploymentAnalyzer', () => {
  it('should detect TypeScript build errors', () => {
    const logs = `
      Some random log lines...
      src/dashboard/components/dashboard/MissionControlLayout.tsx(34,10): error TS6133: 'ScheduledTasksPanel' is declared but its value is never read.
      Another error...
    `;
    const analysis = DeploymentAnalyzer.analyzeLogs(logs);
    
    expect(analysis.type).toBe('build');
    expect(analysis.errorLocation).toEqual({
      file: 'src/dashboard/components/dashboard/MissionControlLayout.tsx',
      line: 34
    });
    expect(analysis.summary).toContain("'ScheduledTasksPanel' is declared but its value is never read");
  });

  it('should detect syntax errors', () => {
    const logs = `
      /app/src/index.ts:10
      const x = ;
                ^
      SyntaxError: Unexpected token ';'
    `;
    const analysis = DeploymentAnalyzer.analyzeLogs(logs);
    
    expect(analysis.type).toBe('build');
    expect(analysis.summary).toContain("Unexpected token ';'");
  });

  it('should detect test failures', () => {
    const logs = `
      RUN v0.34.6
      
      FAIL test/scheduledTasks.test.ts
      × ScheduledTasksEngine Integráció > API Endpoints > should list tasks
      Error: expect(received).toBe(expected) // Object.is equality

      Expected: 200
      Received: 500
    `;
    const analysis = DeploymentAnalyzer.analyzeLogs(logs);
    
    expect(analysis.type).toBe('test');
    // Az analysis.summary egyszerűbb szöveget ad vissza
    expect(analysis.summary).toContain('Unit tests failed');
  });

  it('should generate a valid fix prompt', () => {
    const analysis: DeploymentAnalysis = {
      type: 'build',
      category: 'build',
      title: 'Build Error',
      summary: "Cannot find name 'foo'",
      message: "Cannot find name 'foo'",
      errorLocation: { file: 'src/app.ts', line: 10 },
      rawError: "error TS2304: Cannot find name 'foo'",
      affectedFiles: ['src/app.ts'],
      confidence: 0.95
    };
    
    const prompt = DeploymentAnalyzer.generateFixPrompt(analysis, "console.log(foo);");
    
    expect(prompt).toContain('## Jules Continuous AI - Automated Fix Request');
    expect(prompt).toContain('**Error Category:** BUILD');
    expect(prompt).toContain("Cannot find name 'foo'");
    expect(prompt).toContain('Error Location');
    expect(prompt).toContain('src/app.ts');
    expect(prompt).toContain('### File Content');
  });
});
