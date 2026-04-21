/**
 * run-integration-tests.mjs — Windows-kompatibilis integrációs teszt futató
 *
 * Miért szükséges ez a wrapper?
 * ─────────────────────────────
 * Windows cmd.exe-ben nem működik a `VAR=value command` szintaxis.
 * A `cross-env` nincs telepítve. Ez a Node.js script beállítja
 * a PYTHON_BRIDGE_E2E env változót és futtatja a Vitest-et a
 * platform-független process.env API-n keresztül.
 *
 * Használat: node scripts/run-integration-tests.mjs
 * (npm run test:integration meghívja)
 */

import { spawnSync } from 'child_process';

process.env.PYTHON_BRIDGE_E2E = '1';

const result = spawnSync(
  'npx',
  ['vitest', 'run', '--config', 'vitest.integration.config.ts'],
  {
    stdio: 'inherit',
    env: { ...process.env },
    // shell: true szükséges Windows-on, hogy megtalálja az npx-et
    shell: true,
  },
);

process.exit(result.status ?? 1);
