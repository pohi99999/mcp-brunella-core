import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: [
      'apps/dashboard/**/*.test.{ts,tsx}',
      'test/dashboard/**/*.test.{ts,tsx}',
    ],
    exclude: ['**/node_modules/**', '**/build/**'],
    globals: true,
    setupFiles: ['./tests/test/setup-ui.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './apps/dashboard'),
      '@packages': path.resolve(__dirname, './packages'),
    },
  },
});
