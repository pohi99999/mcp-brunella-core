import { describe, it, expect } from 'vitest';
import { PROJECT_ROOT, resolvePath } from '../../packages/utils/pathResolver.js';
import path from 'path';

describe('PathResolver', () => {
  it('should identify the project root containing package.json', () => {
    // Ellenőrizzük, hogy a PROJECT_ROOT érvényes útvonal-e és tartalmazza a projekt nevét
    expect(PROJECT_ROOT).toBeDefined();
    expect(PROJECT_ROOT).toContain('mcp-brunella-core');
  });

  it('should resolve a relative path to an absolute path from root', () => {
    const resolved = resolvePath('package.json');
    // A feloldott útnak meg kell egyeznie a PROJECT_ROOT + package.json-nal
    const expected = path.resolve(PROJECT_ROOT, 'package.json');
    expect(resolved).toBe(expected);
  });
});
