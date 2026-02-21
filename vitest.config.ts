import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'test/**/*.vitest.ts'],
    exclude: ['**/node_modules/**', '**/build/**', '**/src/dashboard/**', '**/*.e2e.test.ts'],
    globals: true,
    setupFiles: ['./test/setup.ts'],
    testTimeout: 15000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
