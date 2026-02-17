import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'test/**/*.vitest.ts'],
    // Exclude e2e tests from standard unit test runs as they require running server
    exclude: ['**/node_modules/**', '**/build/**', '**/src/dashboard/**', '**/*.e2e.test.ts'],
    globals: true,
    setupFiles: ['./test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
