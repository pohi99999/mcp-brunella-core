#!/usr/bin/env node
/**
 * 🔄 Sync Agent - Brunella Project
 *
 * Automatikusan frissíti a dokumentációt és ellenőrzi a projekt konzisztenciáját.
 *
 * Használat:
 *   node scripts/sync-agent.js              # Teljes szinkronizáció
 *   node scripts/sync-agent.js --check      # Csak ellenőrzés (nem módosít)
 *   node scripts/sync-agent.js --fix        # Automatikus javítás ahol lehet
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// Színek a konzolhoz
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

const log = {
  info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.cyan}━━━ ${msg} ━━━${colors.reset}\n`)
};

// ============================================
// 1. DOKUMENTÁCIÓ FRISSÍTÉS
// ============================================

function updateToolskeszlet() {
  log.info('Toolskeszlet.md frissítése...');

  const toolsDir = path.join(ROOT, 'src/tools');
  const registryPath = path.join(ROOT, 'src/agents/registry.json');

  let content = `# 🛠️ MCP Brunella Core - Eszközkészlet (Tool Inventory)

Ez a dokumentum a szerver által biztosított MCP eszközök automatikusan generált listája.
**Generálva:** ${new Date().toLocaleString('hu-HU')}

---

`;

  // Tools mappából
  if (fs.existsSync(toolsDir)) {
    const toolFiles = fs.readdirSync(toolsDir).filter(f => f.endsWith('.ts'));

    for (const file of toolFiles) {
      const filePath = path.join(toolsDir, file);
      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Egyszerű regex a tool nevekhez és leírásokhoz
      const toolMatches = fileContent.matchAll(/name:\s*['"]([^'"]+)['"].*?description:\s*['"]([^'"]+)['"]/gs);
      const tools = [...toolMatches];

      if (tools.length > 0) {
        const moduleName = file.replace('.ts', '');
        content += `## 📦 ${moduleName}\n`;
        for (const match of tools) {
          content += `- **${match[1]}**: ${match[2]}\n`;
        }
        content += '\n';
      }
    }
  }

  // Agent registry-ből
  if (fs.existsSync(registryPath)) {
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    content += `## 🤖 Ágensek (Agents)\n`;
    for (const agent of registry.agents || []) {
      content += `- **${agent.name}**: ${agent.description || 'Nincs leírás'}\n`;
    }
    content += '\n';
  }

  // CLI parancsok
  content += `## 💻 Brunella CLI Parancsok
- **brunella conductor status**: Projekt státuszának megjelenítése.
- **brunella conductor setup**: Conductor infrastruktúra ellenőrzése.
- **brunella memory list/show/refresh**: Kontextus kezelés.
- **brunella run <tool>**: MCP eszköz futtatása.
- **brunella chat**: Interaktív chat (Ollama).
- **brunella agents**: Ágensek listázása CLI-ből.
`;

  fs.writeFileSync(path.join(ROOT, 'Toolskeszlet.md'), content);
  log.success('Toolskeszlet.md frissítve');
}

function updateProjectStructure() {
  log.info('Projekt struktúra dokumentálása...');

  const structure = [];

  function scanDir(dir, prefix = '', depth = 0) {
    if (depth > 3) return; // Max 3 szint mélység

    const items = fs.readdirSync(dir).filter(item => {
      // Kihagyandó mappák/fájlok
      const skip = ['node_modules', '.git', '.venv', '__pycache__', 'build', '.tmp',
                    '.cache', 'coverage', '*.log', '.env'];
      return !skip.some(s => item === s || item.startsWith('.'));
    });

    for (const item of items.slice(0, 15)) { // Max 15 elem szintenként
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        structure.push(`${prefix}📁 ${item}/`);
        scanDir(itemPath, prefix + '  ', depth + 1);
      } else if (depth < 2) {
        structure.push(`${prefix}📄 ${item}`);
      }
    }
  }

  scanDir(ROOT);

  const content = `# 📁 Projekt Struktúra

**Generálva:** ${new Date().toLocaleString('hu-HU')}

\`\`\`
${structure.join('\n')}
\`\`\`

> Ez egy automatikusan generált áttekintés. Részletekért lásd a CLAUDE.md fájlt.
`;

  fs.writeFileSync(path.join(ROOT, '_PROJECT_STRUCTURE.md'), content);
  log.success('_PROJECT_STRUCTURE.md létrehozva');
}

// ============================================
// 2. KONZISZTENCIA ELLENŐRZÉS
// ============================================

function checkConsistency() {
  log.section('Konzisztencia Ellenőrzés');

  const issues = [];

  // 1. Szükséges fájlok létezése
  const requiredFiles = [
    'package.json',
    'tsconfig.json',
    'CLAUDE.md',
    'src/index.ts',
    'src/cli.ts',
    'conductor/tracks.md'
  ];

  for (const file of requiredFiles) {
    if (!fs.existsSync(path.join(ROOT, file))) {
      issues.push({ type: 'missing', file, message: `Hiányzó fájl: ${file}` });
    }
  }

  // 2. Package.json és build mappa szinkron
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
  const mainFile = packageJson.main;
  if (mainFile && !fs.existsSync(path.join(ROOT, mainFile))) {
    issues.push({
      type: 'build',
      file: mainFile,
      message: `A package.json main fájlja (${mainFile}) nem létezik. Futtasd: npm run build`
    });
  }

  // 3. TypeScript hibák (gyors ellenőrzés)
  try {
    execSync('npx tsc --noEmit 2>&1 | head -20', { cwd: ROOT, encoding: 'utf-8', stdio: 'pipe' });
    log.success('TypeScript: Nincs hiba');
  } catch (e) {
    const errors = e.stdout || e.message;
    if (errors.includes('error TS')) {
      issues.push({ type: 'typescript', message: 'TypeScript hibák vannak. Futtasd: npm run build' });
      log.warn('TypeScript: Hibák találhatók');
    }
  }

  // 4. Tracks.md aktualitása
  const tracksPath = path.join(ROOT, 'conductor/tracks.md');
  if (fs.existsSync(tracksPath)) {
    const tracksStat = fs.statSync(tracksPath);
    const daysSinceUpdate = (Date.now() - tracksStat.mtime.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate > 7) {
      issues.push({
        type: 'stale',
        file: 'conductor/tracks.md',
        message: `A tracks.md ${Math.floor(daysSinceUpdate)} napja nem volt frissítve`
      });
    }
  }

  // 5. .env fájl ellenőrzés
  const envPath = path.join(ROOT, '.env');
  const envExamplePath = path.join(ROOT, '.env.example');
  if (fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
    const envVars = fs.readFileSync(envPath, 'utf-8').match(/^[A-Z_]+=.*/gm) || [];
    const exampleVars = fs.readFileSync(envExamplePath, 'utf-8').match(/^[A-Z_]+=/gm) || [];

    for (const exVar of exampleVars) {
      const varName = exVar.replace('=', '');
      if (!envVars.some(v => v.startsWith(varName + '='))) {
        issues.push({
          type: 'env',
          message: `Hiányzó környezeti változó: ${varName} (lásd .env.example)`
        });
      }
    }
  }

  // Eredmények
  if (issues.length === 0) {
    log.success('Minden rendben! Nincs konzisztencia probléma.');
  } else {
    log.warn(`${issues.length} probléma található:`);
    for (const issue of issues) {
      log.error(`  ${issue.message}`);
    }
  }

  return issues;
}

// ============================================
// 3. GIT VÁLTOZÁSOK ÖSSZEFOGLALÓ
// ============================================

function getRecentChanges() {
  log.section('Legutóbbi Változások');

  try {
    // Utolsó 5 commit
    const commits = execSync('git log --oneline -5', { cwd: ROOT, encoding: 'utf-8' });
    log.info('Utolsó commitok:');
    console.log(colors.dim + commits + colors.reset);

    // Módosított fájlok (uncommitted)
    const status = execSync('git status --short', { cwd: ROOT, encoding: 'utf-8' });
    if (status.trim()) {
      log.warn('Nem commitolt változások:');
      console.log(colors.yellow + status + colors.reset);
    } else {
      log.success('Minden változás commitolva');
    }

    return { commits, status };
  } catch {
    log.warn('Git nem elérhető');
    return null;
  }
}

// ============================================
// 4. AI KONTEXTUS FRISSÍTÉS
// ============================================

function regenerateAIContext() {
  log.info('AI kontextus újragenerálása...');

  try {
    execSync('node scripts/generate-ai-context.js', { cwd: ROOT, stdio: 'inherit' });
  } catch {
    log.warn('AI kontextus generálás sikertelen');
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');
  const autoFix = args.includes('--fix');

  console.log(`
${colors.cyan}╔═══════════════════════════════════════╗
║     🔄 BRUNELLA SYNC AGENT            ║
║     Dokumentáció & Konzisztencia      ║
╚═══════════════════════════════════════╝${colors.reset}
`);

  // 1. Konzisztencia ellenőrzés
  const issues = checkConsistency();

  // 2. Git változások
  getRecentChanges();

  if (checkOnly) {
    log.info('Csak ellenőrzés mód - nem módosítok semmit');
    process.exit(issues.length > 0 ? 1 : 0);
  }

  // 3. Dokumentáció frissítés
  log.section('Dokumentáció Frissítés');
  updateToolskeszlet();
  updateProjectStructure();
  regenerateAIContext();

  // 4. Auto-fix ha kérték
  if (autoFix && issues.some(i => i.type === 'build')) {
    log.section('Automatikus Javítás');
    log.info('Build futtatása...');
    try {
      execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });
      log.success('Build sikeres');
    } catch {
      log.error('Build sikertelen');
    }
  }

  // Összefoglaló
  log.section('Összefoglaló');
  console.log(`
Frissített fájlok:
  - Toolskeszlet.md
  - _PROJECT_STRUCTURE.md
  - _AI_CONTEXT.md

${issues.length > 0 ? colors.yellow + '⚠ ' + issues.length + ' probléma maradt' + colors.reset : colors.green + '✓ Minden rendben!' + colors.reset}
`);
}

main().catch(console.error);
