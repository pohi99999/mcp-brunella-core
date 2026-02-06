import { spawnSync } from 'child_process';
import process from 'process';

/**
 * Jules Self-Heal: CI bukás után Jules CLI-val javítási PR indítása.
 * Telepítés: npm install -g @google/jules
 * Auth: jules login (lokálisan, böngészős) – CI-ben JULES_API_KEY szükséges lehet.
 */
const task = process.env.JULES_TASK
  || 'Run Scenario 1 from testing/TEST_BOOK.md and fix any issues found. Open a PR with the fix.';

// Jules remote new --repo . --session "<task>"
const args = ['remote', 'new', '--repo', '.', '--session', task];

console.log(`[jules-self-heal] Running: jules ${args.join(' ')}`);
const result = spawnSync('jules', args, { stdio: 'inherit', shell: true });

if (result.status !== 0) {
  console.warn('[jules-self-heal] Jules exited with code', result.status, '- auth vagy hiba. Kilépés 0.');
  process.exit(0); // Ne buktassuk a workflow-t – a self-heal best-effort
}
process.exit(0);
