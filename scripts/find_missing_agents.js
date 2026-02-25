import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const agentsDir = path.join(__dirname, '..', 'src', 'agents');
const registryPath = path.join(agentsDir, 'registry.json');

// Gyűjtsük össze az agent fájlokat
const agentFiles = fs.readdirSync(agentsDir)
  .filter(f => f.endsWith('Agent.ts'))
  .map(f => f.replace('.ts', ''))
  .filter(f => f !== 'BaseAgent'); // BaseAgent nem kell a registry-ba

// Olvassuk be a registry-t
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const registeredClasses = [...new Set(registry.agents.map(a => a.class))];

// Találjuk meg a hiányzó ügynököket
const missing = agentFiles.filter(f => !registeredClasses.includes(f));

console.log('\n=== HIÁNYZÓ ÜGYNÖKÖK ===');
console.log(`Agent fájlok: ${agentFiles.length}`);
console.log(`Registry bejegyzések: ${registry.agents.length} (${registeredClasses.length} unique class)`);
console.log(`\nHiányzó ügynökök (${missing.length}):`);
missing.forEach(m => console.log(`  - ${m}`));
