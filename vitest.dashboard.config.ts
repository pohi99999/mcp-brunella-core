import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        environment: 'jsdom',
        include: [
          'test/dashboard/**/*.test.{ts,tsx}',
          'src/dashboard/**/*.test.{ts,tsx}', // component-level tests co-located with source
        ],
        globals: true,
        setupFiles: ['./test/dashboard/setup.ts'],
        css: false,
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src/dashboard'),
        },
    },
});

