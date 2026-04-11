/**
 * Vitest config for integration tests.
 *
 * A fő vitest.config.ts kizárja a test/integration/** mappát (`exclude` lista).
 * Ez a külön config felülírja azt, hogy az integrációs tesztek is futtathatók legyenek.
 *
 * Futtatás: npm run test:integration
 *   (scripts/run-integration-tests.mjs beállítja a PYTHON_BRIDGE_E2E=1 env változót)
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/integration/**/*.test.ts'],
    // NE exclude-oljuk a test/integration/** mappát — ez az egész pont
    exclude: ['**/node_modules/**', '**/build/**'],
    globals: true,
    setupFiles: ['./test/setup.ts'],
    testTimeout: 30000, // 30s — Python szerver indítása időbe kerülhet
    fileParallelism: false,
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
