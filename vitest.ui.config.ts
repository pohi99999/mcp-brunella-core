import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: [
      'tests/test/dashboard/**/*.test.{ts,tsx}',
      'apps/dashboard/**/*.test.{ts,tsx}',
    ],
    globals: true,
    setupFiles: ['./tests/test/dashboard/setup.ts'],
    css: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './apps/dashboard'),
      '@packages': path.resolve(__dirname, './packages'),
    },
  },
});
