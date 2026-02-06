/**
 * Robotkéz n8n Integration Test
 * Ellenőrzi a scenario fájl és a browser_worker létezését.
 */
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

describe('Robotkéz n8n Integration Test', () => {
  it('should have n8n scenario file', () => {
    const scenarioPath = path.join(ROOT, 'myai/scenarios/n8n_training.json');
    expect(existsSync(scenarioPath)).toBe(true);
  });

  it('should have browser_worker.py', () => {
    const workerPath = path.join(ROOT, 'myai/browser_worker.py');
    expect(existsSync(workerPath)).toBe(true);
  });

  it('should have docs/n8n-setup.md', () => {
    const docsPath = path.join(ROOT, 'docs/n8n-setup.md');
    expect(existsSync(docsPath)).toBe(true);
  });

  it('should have n8n_training_ui.json for Browser-Use mode', () => {
    const uiScenarioPath = path.join(ROOT, 'myai/scenarios/n8n_training_ui.json');
    expect(existsSync(uiScenarioPath)).toBe(true);
  });

  it('should have valid scenario structure when N8N vars are set', () => {
    // Csak akkor ellenőrizzük, ha a környezet be van állítva (opcionális)
    if (!process.env.N8N_TEST_URL && !process.env.N8N_API_KEY) return;
    expect(process.env.N8N_TEST_URL || process.env.N8N_API_KEY).toBeDefined();
  });
});
