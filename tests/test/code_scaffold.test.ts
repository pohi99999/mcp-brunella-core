/**
 * P9 Code Scaffolding Tests
 * Tests TemplateEngine functionality including:
 * - Template listing and retrieval
 * - Variable replacement logic
 * - File generation validation
 * - Preview mode
 * - Built-in templates presence
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';

// Mock logger
vi.mock('@packages/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

// Mock fs/promises
// Use vi.hoisted for variables used in factory
const { mockWriteFile, mockMkdir, mockAccess } = vi.hoisted(() => ({
  mockWriteFile: vi.fn(),
  mockMkdir: vi.fn(),
  mockAccess: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  default: {
    writeFile: mockWriteFile,
    mkdir: mockMkdir,
    access: mockAccess,
  },
  writeFile: mockWriteFile,
  mkdir: mockMkdir,
  access: mockAccess,
}));

// Import TemplateEngine
import { TemplateEngine } from '@packages/agents/codeScaffold.js';

describe('TemplateEngine - P9 Code Scaffolding', () => {
  let engine: TemplateEngine;
  const workspaceRoot = '/test/workspace';

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new TemplateEngine(workspaceRoot);
  });

  // ==================== Template Management ====================

  it('should initialize with built-in templates', () => {
    const templates = engine.listTemplates();
    expect(templates.length).toBeGreaterThan(0);
    
    // Check key templates exist
    const names = templates.map(t => t.name);
    expect(names).toContain('react-component');
    expect(names).toContain('rest-api');
    expect(names).toContain('agent');
    expect(names).toContain('test-file');
  });

  it('should retrieve specific template', () => {
    const template = engine.getTemplate('react-component');
    expect(template).toBeDefined();
    expect(template?.name).toBe('react-component');
    expect(template?.category).toBe('component');
  });

  it('should return null for unknown template', () => {
    const template = engine.getTemplate('unknown-template');
    expect(template).toBeNull();
  });

  // ==================== Variable Replacement ====================

  it('should generate files with variable replacement', async () => {
    mockAccess.mockRejectedValue(new Error('ENOENT')); // File doesn't exist
    mockWriteFile.mockResolvedValue(undefined);
    mockMkdir.mockResolvedValue(undefined);

    const variables = { ComponentName: 'MyButton', description: 'Click me' };
    const files = await engine.generateFromTemplate('react-component', variables);

    expect(files.length).toBe(2);
    
    // Check file paths
    expect(files[0].path).toBe('src/components/MyButton.tsx');
    expect(files[1].path).toBe('test/components/MyButton.test.tsx');

    // Check content replacement
    expect(files[0].content).toContain('export const MyButton: React.FC');
    expect(files[0].content).toContain('Click me');
    
    // Check file system writes
    expect(mockWriteFile).toHaveBeenCalledTimes(2);
    // Path normalization might vary, check partial match
    const expectedPath = path.join('src', 'components', 'MyButton.tsx');
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining(expectedPath),
      expect.any(String),
      'utf-8'
    );
  });

  it('should use default variable values', async () => {
    mockAccess.mockRejectedValue(new Error('ENOENT'));
    
    const variables = { ComponentName: 'MyButton' }; // description missing, should use default
    const files = await engine.generateFromTemplate('react-component', variables);

    expect(files[0].content).toContain('Component description'); // Default value
  });

  it('should throw error when required variable is missing', async () => {
    const variables = {}; // ComponentName is required
    await expect(engine.generateFromTemplate('react-component', variables))
      .rejects.toThrow('Required variable missing: ComponentName');
  });

  // ==================== Modes (Preview/Overwrite) ====================

  it('should preview generation without writing files', async () => {
    const variables = { ComponentName: 'PreviewComp' };
    const files = await engine.previewGeneration('react-component', variables);

    expect(files.length).toBe(2);
    expect(files[0].preview).toBe(true);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('should throw error if file exists and overwrite is false', async () => {
    mockAccess.mockResolvedValue(undefined); // File exists

    const variables = { ComponentName: 'ExistingComp' };
    await expect(engine.generateFromTemplate('react-component', variables, { overwrite: false }))
      .rejects.toThrow('File already exists');
  });

  it('should overwrite file if overwrite is true', async () => {
    mockAccess.mockResolvedValue(undefined); // File exists

    const variables = { ComponentName: 'OverwriteComp' };
    await engine.generateFromTemplate('react-component', variables, { overwrite: true });

    expect(mockWriteFile).toHaveBeenCalled();
  });
});
