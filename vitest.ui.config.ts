import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom', // Use JSDOM for UI component testing
    include: ['src/dashboard/**/*.test.{ts,tsx}'], // Include tests within the dashboard directory
    exclude: ['**/node_modules/**', '**/build/**'],
    globals: true,
    setupFiles: ['./test/setup.ts'], // Re-use existing setup if compatible
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
