#!/usr/bin/env node
/**
 * AI Context Generator - Brunella Project
 *
 * Ez a script összegyűjti a projekt lényegét egyetlen fájlba,
 * amit bemásolhatsz bármely AI asszisztensnek.
 *
 * Használat:
 *   node scripts/generate-ai-context.js
 *   node scripts/generate-ai-context.js --full    (teljes verzió)
 *   node scripts/generate-ai-context.js --mini    (rövid verzió)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// Fájlok amiket be kell olvasni a kontextushoz
const CONTEXT_FILES = {
  essential: [
    { path: 'CLAUDE.md', label: 'Projekt Útmutató' },
    { path: 'conductor/tracks.md', label: 'Fejlesztési Státusz', maxLines: 100 },
    { path: 'Toolskeszlet.md', label: 'Elérhető Eszközök' },
  ],
  full: [
    { path: 'Brunella.md', label: 'Teljes Dokumentáció' },
    { path: 'src/agents/registry.json', label: 'Agent Definíciók' },
    { path: 'package.json', label: 'Függőségek' },
    { path: 'conductor/tech-stack.md', label: 'Tech Stack' },
  ]
};

function readFileContent(filePath, maxLines = null) {
  const fullPath = path.join(ROOT, filePath);
  if (!fs.existsSync(fullPath)) {
    return `[Fájl nem található: ${filePath}]`;
  }

  let content = fs.readFileSync(fullPath, 'utf-8');

  if (maxLines) {
    const lines = content.split('\n');
    if (lines.length > maxLines) {
      content = lines.slice(0, maxLines).join('\n') + `\n\n... (${lines.length - maxLines} további sor)`;
    }
  }

  return content;
}

function getRecentChanges() {
  // Git változások az elmúlt 7 napból
  try {
    const result = execSync('git log --oneline --since="7 days ago" -20', {
      cwd: ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return result || 'Nincs git history';
  } catch {
    return 'Git nem elérhető';
  }
}

function generateContext(mode = 'essential') {
  const timestamp = new Date().toISOString().split('T')[0];
  const files = mode === 'full'
    ? [...CONTEXT_FILES.essential, ...CONTEXT_FILES.full]
    : CONTEXT_FILES.essential;

  let output = `# 🧠 Brunella Project Context
**Generálva:** ${timestamp}
**Mód:** ${mode}

> Másold be ezt a teljes szöveget az AI asszisztensnek a projekt megértéséhez.

---

`;

  for (const file of files) {
    const content = readFileContent(file.path, file.maxLines);
    output += `## 📄 ${file.label} (${file.path})

\`\`\`
${content}
\`\`\`

---

`;
  }

  // Projekt struktúra (rövid)
  output += `## 📁 Projekt Struktúra (Főbb Mappák)

\`\`\`
src/
  agents/      - AI ügynökök (Orchestrator, Developer, Evaluator...)
  server/      - Express API + Socket.IO
  dashboard/   - React frontend
  tools/       - MCP eszközök
myai/          - Python alrendszer (FastAPI, Playwright)
conductor/     - Projekt menedzsment, tracks
\`\`\`

---

## 💡 Gyors Útmutató az AI-nak

1. Ez egy **multi-agent AI rendszer** ami automatizálja a fejlesztést
2. A **Conductor** kezeli a fejlesztési szálakat (tracks)
3. **Ollama** a lokális LLM (llama3.1, deepseek-coder)
4. A gazdája **nem programozó** - érthetően kommunikálj
5. Ha kódot írsz, magyarázd el mit csinál

`;

  return output;
}

// Main
const args = process.argv.slice(2);
const mode = args.includes('--full') ? 'full' :
             args.includes('--mini') ? 'mini' : 'essential';

const context = generateContext(mode);
const outputPath = path.join(ROOT, '_AI_CONTEXT.md');

fs.writeFileSync(outputPath, context);

console.log(`✅ AI kontextus generálva: ${outputPath}`);
console.log(`   Mód: ${mode}`);
console.log(`   Méret: ${(context.length / 1024).toFixed(1)} KB`);
console.log(`\n📋 Másold be a fájl tartalmát az AI asszisztensednek!`);
