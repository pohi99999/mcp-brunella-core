// Purpose: Master Vitest runner that unifies the core Brunella test entrypoints.
// vitest.master.config.ts
// MASTER TEST RUNNER — runs all test suites in sequence
// Usage: npx vitest run --config vitest.master.config.ts

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'brunella-master',
    // Core tests (fastest, run first)
    include: [
      'test/**/*.test.ts',
      'src/**/*.test.ts',
    ],
    exclude: [
      'test/cli-e2e*',
      'test/cli-phase*',
      'test/phase*',
      'test/swarm_smoke*',
      'node_modules/**',
      'build/**',
      'src-tauri/**',
    ],
    globals: true,
    environment: 'node',
    reporters: ['verbose'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/dashboard/**'],
    },
    // Timeout for AI-heavy tests
    testTimeout: 30000,
    hookTimeout: 10000,
  },
});
