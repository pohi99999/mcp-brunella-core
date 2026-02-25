import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/dashboard/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/build/**'],
    globals: true,
    setupFiles: ['./test/dashboard/setup.ts'], // dashboard-specific setup (matchMedia, ResizeObserver, jest-dom)
    css: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/dashboard'), // dashboard imports use @/store, @/lib, @/components
    },
  },
});

