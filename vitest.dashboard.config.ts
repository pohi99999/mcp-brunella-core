import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        environment: 'jsdom',
        include: ['test/dashboard/**/*.test.tsx', 'test/dashboard/**/*.test.ts'],
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
