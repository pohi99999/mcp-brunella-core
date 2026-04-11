import { defineConfig } from 'vitest/config';
import path from 'path';

const configuredRetry = Number.parseInt(process.env.VITEST_RETRY ?? '0', 10);

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'test/**/*.vitest.ts'],
    exclude: ['**/node_modules/**', '**/build/**', '**/src/dashboard/**', '**/*.e2e.test.ts', 'test/integration/**'],
    globals: true,
    setupFiles: ['./test/setup.ts'],
    testTimeout: 15000,
    fileParallelism: false,
    retry: Number.isFinite(configuredRetry) && configuredRetry > 0 ? configuredRetry : 0,
    pool: 'forks',
    poolOptions: {
      forks: {
        execArgv: ['--max-old-space-size=4096'],
        maxForks: 1,
        minForks: 1,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
