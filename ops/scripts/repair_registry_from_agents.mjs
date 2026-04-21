import fs from 'fs';
import path from 'path';

const repo = 'f:/mcp-brunella-core';
const agentsDir = path.join(repo, 'src', 'agents');
const registryPath = path.join(agentsDir, 'registry.json');

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const existingClasses = new Set(registry.agents.map((a) => a.class));

const files = fs
  .readdirSync(agentsDir)
  .filter((f) => f.endsWith('Agent.ts') && f !== 'BaseAgent.ts');

const toAdd = [];

function pick(re, text, fallback = '') {
  const m = text.match(re);
  return m?.[1] ?? fallback;
}

for (const file of files) {
  const className = file.replace('.ts', '');
  if (existingClasses.has(className)) continue;

  const full = path.join(agentsDir, file);
  const txt = fs.readFileSync(full, 'utf8');

  const name =
    pick(/\bname\s*=\s*['"]([^'"]+)['"]/m, txt) || className.replace(/Agent$/, '');
  const role = pick(/\brole\s*=\s*['"]([^'"]+)['"]/m, txt, 'Auto-registered agent');
  const description = pick(
    /\bdescription\s*=\s*['"]([^'"]+)['"]/m,
    txt,
    `${name} agent`
  );

  const triggers = [name, className]
    .join(' ')
    .toLowerCase()
    .split(/[^a-z0-9áéíóöőúüű]+/)
    .filter(Boolean)
    .slice(0, 4);

  toAdd.push({
    name,
    module: `./agents/${className}.js`,
    class: className,
    role,
    description,
    triggers: [...new Set(triggers)],
    priority: 1,
  });
}

registry.agents.push(...toAdd);
registry.agents.sort((a, b) => String(a.name).localeCompare(String(b.name)));

fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n', 'utf8');

console.log(`Added missing agents: ${toAdd.length}`);
for (const a of toAdd) {
  console.log(` + ${a.name} (${a.class})`);
}
console.log(`Total registry agents: ${registry.agents.length}`);
