#!/usr/bin/env node
/**
 * 👁️ Watch Changes - Brunella Project
 *
 * Figyeli a projekt változásait és értesít ha valami "gyanús" történik.
 * Összehasonlítja a várt struktúrát a valósággal.
 *
 * Használat:
 *   node scripts/watch-changes.js              # Egyszer lefut és report-ol
 *   node scripts/watch-changes.js --watch      # Folyamatosan figyel
 *   node scripts/watch-changes.js --report     # Részletes markdown report
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// Színek
const c = {
  reset: '\x1b[0m', green: '\x1b[32m', yellow: '\x1b[33m',
  red: '\x1b[31m', cyan: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m'
};

// ============================================
// VÁRT PROJEKT STRUKTÚRA (SZABÁLYOK)
// ============================================

const EXPECTED_STRUCTURE = {
  // Kötelező fájlok
  requiredFiles: [
    'package.json',
    'tsconfig.json',
    'CLAUDE.md',
    '.gitignore',
    'src/index.ts',
    'src/cli.ts',
    'conductor/tracks.md',
    'conductor/tech-stack.md'
  ],

  // Kötelező mappák
  requiredDirs: [
    'src',
    'src/agents',
    'src/server',
    'src/tools',
    'conductor',
    'myai'
  ],

  // Nem kívánatos fájlok (figyelmeztetés ha léteznek)
  unwantedFiles: [
    '.env.local',      // Lokális env ne legyen commitolva
    'npm-debug.log',
    'yarn-error.log',
    '.DS_Store'
  ],

  // Fájl méret limitek (KB)
  sizeLimits: {
    'konyvtarfa.md': 10000,  // 10MB max - ha nagyobb, gond van
    '*.log': 5000,           // 5MB max log fájlok
    '*.json': 2000           // 2MB max JSON
  },

  // Függőség szabályok
  dependencies: {
    required: ['express', 'typescript', 'socket.io'],
    forbidden: []  // Ha valami nem megengedett
  }
};

// ============================================
// VÁLTOZÁS DETEKTÁLÁS
// ============================================

function detectChanges() {
  const changes = {
    added: [],
    modified: [],
    deleted: [],
    untracked: []
  };

  try {
    // Git diff
    const diffOutput = execSync('git diff --name-status HEAD~5 HEAD 2>/dev/null || echo ""', {
      cwd: ROOT, encoding: 'utf-8'
    });

    for (const line of diffOutput.trim().split('\n')) {
      if (!line) continue;
      const [status, file] = line.split('\t');
      if (status === 'A') changes.added.push(file);
      else if (status === 'M') changes.modified.push(file);
      else if (status === 'D') changes.deleted.push(file);
    }

    // Untracked files
    const untrackedOutput = execSync('git ls-files --others --exclude-standard 2>/dev/null | head -20', {
      cwd: ROOT, encoding: 'utf-8'
    });
    changes.untracked = untrackedOutput.trim().split('\n').filter(Boolean);

  } catch (e) {
    // Git nem elérhető
  }

  return changes;
}

// ============================================
// STRUKTÚRA ELLENŐRZÉS
// ============================================

function checkStructure() {
  const issues = [];
  const warnings = [];

  // 1. Kötelező fájlok
  for (const file of EXPECTED_STRUCTURE.requiredFiles) {
    if (!fs.existsSync(path.join(ROOT, file))) {
      issues.push({
        severity: 'error',
        type: 'missing_file',
        file,
        message: `Hiányzó kötelező fájl: ${file}`,
        fix: `Hozd létre a ${file} fájlt vagy állítsd vissza git-ből`
      });
    }
  }

  // 2. Kötelező mappák
  for (const dir of EXPECTED_STRUCTURE.requiredDirs) {
    if (!fs.existsSync(path.join(ROOT, dir))) {
      issues.push({
        severity: 'error',
        type: 'missing_dir',
        file: dir,
        message: `Hiányzó kötelező mappa: ${dir}/`,
        fix: `mkdir ${dir}`
      });
    }
  }

  // 3. Nem kívánatos fájlok
  for (const file of EXPECTED_STRUCTURE.unwantedFiles) {
    if (fs.existsSync(path.join(ROOT, file))) {
      warnings.push({
        severity: 'warning',
        type: 'unwanted_file',
        file,
        message: `Nem kívánatos fájl: ${file}`,
        fix: `rm ${file} && echo "${file}" >> .gitignore`
      });
    }
  }

  // 4. Méret ellenőrzés
  for (const [pattern, maxSizeKB] of Object.entries(EXPECTED_STRUCTURE.sizeLimits)) {
    const files = pattern.includes('*')
      ? findFiles(ROOT, pattern.replace('*', ''))
      : [path.join(ROOT, pattern)];

    for (const file of files) {
      if (fs.existsSync(file)) {
        const sizeKB = fs.statSync(file).size / 1024;
        if (sizeKB > maxSizeKB) {
          warnings.push({
            severity: 'warning',
            type: 'large_file',
            file: path.relative(ROOT, file),
            message: `Túl nagy fájl: ${path.basename(file)} (${(sizeKB/1024).toFixed(1)}MB > ${maxSizeKB/1024}MB limit)`,
            fix: `Töröld vagy tömörítsd a fájlt`
          });
        }
      }
    }
  }

  // 5. Package.json konzisztencia
  const pkgPath = path.join(ROOT, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

    // Kötelező függőségek
    for (const dep of EXPECTED_STRUCTURE.dependencies.required) {
      if (!pkg.dependencies?.[dep] && !pkg.devDependencies?.[dep]) {
        warnings.push({
          severity: 'warning',
          type: 'missing_dep',
          file: 'package.json',
          message: `Hiányzó függőség: ${dep}`,
          fix: `npm install ${dep}`
        });
      }
    }
  }

  // 6. Build aktualitás
  const srcIndex = path.join(ROOT, 'src/index.ts');
  const buildIndex = path.join(ROOT, 'build/index.js');
  if (fs.existsSync(srcIndex) && fs.existsSync(buildIndex)) {
    const srcTime = fs.statSync(srcIndex).mtime;
    const buildTime = fs.statSync(buildIndex).mtime;
    if (srcTime > buildTime) {
      warnings.push({
        severity: 'warning',
        type: 'stale_build',
        file: 'build/',
        message: 'A build régebbi mint a forráskód',
        fix: 'npm run build'
      });
    }
  }

  return { issues, warnings };
}

function findFiles(dir, extension, maxDepth = 3, depth = 0) {
  if (depth > maxDepth) return [];
  const results = [];

  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      if (item.startsWith('.') || item === 'node_modules') continue;
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);
      if (stat.isDirectory()) {
        results.push(...findFiles(itemPath, extension, maxDepth, depth + 1));
      } else if (item.endsWith(extension)) {
        results.push(itemPath);
      }
    }
  } catch {}

  return results;
}

// ============================================
// JAVÍTÁSI JAVASLATOK GENERÁLÁSA
// ============================================

function generateFixInstructions(issues, warnings) {
  if (issues.length === 0 && warnings.length === 0) {
    return null;
  }

  let instructions = `# 🔧 Javítási Utasítások

**Generálva:** ${new Date().toLocaleString('hu-HU')}

Másold be ezt a kódoló ügynöknek:

---

## Feladat
Javítsd ki az alábbi problémákat a projektben.

## Hibák (${issues.length} db)
`;

  for (const issue of issues) {
    instructions += `
### ${issue.file}
- **Probléma:** ${issue.message}
- **Javítás:** \`${issue.fix}\`
`;
  }

  instructions += `
## Figyelmeztetések (${warnings.length} db)
`;

  for (const warn of warnings) {
    instructions += `
### ${warn.file}
- **Probléma:** ${warn.message}
- **Javítás:** \`${warn.fix}\`
`;
  }

  instructions += `
---

## Ellenőrzés
A javítások után futtasd:
\`\`\`bash
npm run build
npm test
node scripts/watch-changes.js
\`\`\`
`;

  return instructions;
}

// ============================================
// REPORT GENERÁLÁS
// ============================================

function generateReport(changes, structure) {
  const timestamp = new Date().toLocaleString('hu-HU');

  const report = `# 📊 Projekt Állapot Report

**Generálva:** ${timestamp}

---

## 📈 Változások (utolsó 5 commit)

| Típus | Fájlok száma |
|-------|--------------|
| ➕ Hozzáadott | ${changes.added.length} |
| ✏️ Módosított | ${changes.modified.length} |
| ❌ Törölt | ${changes.deleted.length} |
| ❓ Untracked | ${changes.untracked.length} |

${changes.added.length > 0 ? `### Új fájlok\n${changes.added.map(f => `- \`${f}\``).join('\n')}\n` : ''}
${changes.modified.length > 0 ? `### Módosított fájlok\n${changes.modified.map(f => `- \`${f}\``).join('\n')}\n` : ''}
${changes.untracked.length > 0 ? `### Untracked fájlok\n${changes.untracked.slice(0, 10).map(f => `- \`${f}\``).join('\n')}\n` : ''}

---

## 🔍 Struktúra Ellenőrzés

### Hibák (${structure.issues.length})
${structure.issues.length === 0 ? '✅ Nincs hiba!' : structure.issues.map(i => `- ❌ ${i.message}`).join('\n')}

### Figyelmeztetések (${structure.warnings.length})
${structure.warnings.length === 0 ? '✅ Nincs figyelmeztetés!' : structure.warnings.map(w => `- ⚠️ ${w.message}`).join('\n')}

---

## 📋 Összefoglaló

${structure.issues.length === 0 && structure.warnings.length === 0
  ? '🎉 **Minden rendben!** A projekt struktúrája megfelelő.'
  : `⚠️ **${structure.issues.length} hiba és ${structure.warnings.length} figyelmeztetés** található. Lásd a javítási utasításokat: \`_FIX_INSTRUCTIONS.md\``
}
`;

  return report;
}

// ============================================
// MAIN
// ============================================

function main() {
  const args = process.argv.slice(2);
  const watchMode = args.includes('--watch');
  const reportMode = args.includes('--report');

  console.log(`
${c.cyan}╔═══════════════════════════════════════╗
║     👁️ BRUNELLA CHANGE WATCHER        ║
║     Változás Figyelő                   ║
╚═══════════════════════════════════════╝${c.reset}
`);

  // Változások és struktúra ellenőrzés
  const changes = detectChanges();
  const structure = checkStructure();

  // Konzol output
  console.log(`${c.bold}📈 Változások:${c.reset}`);
  console.log(`   ➕ Új: ${changes.added.length}  ✏️ Módosított: ${changes.modified.length}  ❌ Törölt: ${changes.deleted.length}`);

  console.log(`\n${c.bold}🔍 Struktúra:${c.reset}`);
  if (structure.issues.length === 0) {
    console.log(`   ${c.green}✓ Nincs hiba${c.reset}`);
  } else {
    console.log(`   ${c.red}✗ ${structure.issues.length} hiba${c.reset}`);
    for (const issue of structure.issues) {
      console.log(`     ${c.red}•${c.reset} ${issue.message}`);
    }
  }

  if (structure.warnings.length > 0) {
    console.log(`   ${c.yellow}⚠ ${structure.warnings.length} figyelmeztetés${c.reset}`);
    for (const warn of structure.warnings) {
      console.log(`     ${c.yellow}•${c.reset} ${warn.message}`);
    }
  }

  // Report és Fix instructions generálás
  if (reportMode || structure.issues.length > 0 || structure.warnings.length > 0) {
    const report = generateReport(changes, structure);
    fs.writeFileSync(path.join(ROOT, '_CHANGE_REPORT.md'), report);
    console.log(`\n${c.cyan}📄 Report mentve: _CHANGE_REPORT.md${c.reset}`);

    const fixInstructions = generateFixInstructions(structure.issues, structure.warnings);
    if (fixInstructions) {
      fs.writeFileSync(path.join(ROOT, '_FIX_INSTRUCTIONS.md'), fixInstructions);
      console.log(`${c.yellow}🔧 Javítási utasítások: _FIX_INSTRUCTIONS.md${c.reset}`);
      console.log(`   ${c.dim}Másold be a kódoló ügynöknek!${c.reset}`);
    }
  }

  // Watch mód
  if (watchMode) {
    console.log(`\n${c.cyan}👁️ Figyelés mód... (Ctrl+C a kilépéshez)${c.reset}`);
    setInterval(() => {
      const newStructure = checkStructure();
      if (newStructure.issues.length !== structure.issues.length) {
        console.log(`\n${c.yellow}⚠️ Változás detektálva!${c.reset}`);
        // Itt lehetne notification küldeni
      }
    }, 30000); // 30 másodpercenként
  }

  // Exit code
  process.exit(structure.issues.length > 0 ? 1 : 0);
}

main();
