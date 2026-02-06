#!/usr/bin/env node
/**
 * 📝 AI Chat Log - Brunella Project
 *
 * Központi hely ahol elmented melyik AI-val mit beszéltél.
 * Segít követni a fejlesztési döntéseket és visszakeresni információkat.
 *
 * Használat:
 *   node scripts/ai-chat-log.js add                    # Új bejegyzés (interaktív)
 *   node scripts/ai-chat-log.js add --ai "Claude" --topic "Dashboard fix"
 *   node scripts/ai-chat-log.js list                   # Összes bejegyzés
 *   node scripts/ai-chat-log.js search "dashboard"     # Keresés
 *   node scripts/ai-chat-log.js export                 # Markdown export
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const LOG_FILE = path.join(ROOT, '_AI_CHAT_LOG.json');
const LOG_MD = path.join(ROOT, '_AI_CHAT_LOG.md');

// Színek
const c = {
  reset: '\x1b[0m', green: '\x1b[32m', yellow: '\x1b[33m',
  red: '\x1b[31m', cyan: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m'
};

// ============================================
// ADATKEZELÉS
// ============================================

function loadLog() {
  if (!fs.existsSync(LOG_FILE)) {
    return { entries: [], lastId: 0 };
  }
  return JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8'));
}

function saveLog(log) {
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
}

// ============================================
// BEJEGYZÉS HOZZÁADÁSA
// ============================================

async function addEntry(options = {}) {
  const log = loadLog();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

  console.log(`\n${c.cyan}📝 Új AI Chat Bejegyzés${c.reset}\n`);

  // AI típus
  const aiTypes = ['Claude Code', 'Claude App', 'Gemini App', 'Gemini CLI', 'Cursor Agent', 'GPT', 'Egyéb'];
  console.log('Melyik AI-val beszéltél?');
  aiTypes.forEach((ai, i) => console.log(`  ${i + 1}. ${ai}`));

  let ai = options.ai;
  if (!ai) {
    const aiChoice = await question('\nVálassz (1-7): ');
    ai = aiTypes[parseInt(aiChoice) - 1] || aiTypes[6];
  }

  // Téma
  let topic = options.topic;
  if (!topic) {
    topic = await question('\nTéma (röviden, pl. "Dashboard Socket.IO fix"): ');
  }

  // Eredmény
  console.log('\nMi lett az eredmény?');
  console.log('  1. ✅ Sikeres - működik');
  console.log('  2. ⚠️ Részben sikeres - van még teendő');
  console.log('  3. ❌ Sikertelen - nem működött');
  console.log('  4. 💡 Csak ötletelés - nem volt kód');

  const resultChoice = await question('\nVálassz (1-4): ');
  const results = ['success', 'partial', 'failed', 'brainstorm'];
  const result = results[parseInt(resultChoice) - 1] || 'partial';

  // Érintett fájlok
  const filesInput = await question('\nÉrintett fájlok (vesszővel elválasztva, vagy üres): ');
  const files = filesInput ? filesInput.split(',').map(f => f.trim()) : [];

  // Összefoglaló
  console.log('\nRövid összefoglaló (mit csináltatok, mit tanultál):');
  const summary = await question('> ');

  // Következő lépések
  const nextSteps = await question('\nKövetkező lépések (ha van): ');

  rl.close();

  // Bejegyzés létrehozása
  const entry = {
    id: ++log.lastId,
    timestamp: new Date().toISOString(),
    ai,
    topic,
    result,
    files,
    summary,
    nextSteps: nextSteps || null
  };

  log.entries.push(entry);
  saveLog(log);

  console.log(`\n${c.green}✓ Bejegyzés mentve! (ID: ${entry.id})${c.reset}`);

  // Markdown frissítése
  exportToMarkdown();
}

// ============================================
// LISTÁZÁS
// ============================================

function listEntries(limit = 20) {
  const log = loadLog();

  console.log(`\n${c.cyan}📋 AI Chat Log (utolsó ${limit} bejegyzés)${c.reset}\n`);

  if (log.entries.length === 0) {
    console.log(`${c.dim}Még nincs bejegyzés. Használd: node scripts/ai-chat-log.js add${c.reset}`);
    return;
  }

  const entries = log.entries.slice(-limit).reverse();

  for (const entry of entries) {
    const date = new Date(entry.timestamp).toLocaleDateString('hu-HU');
    const resultIcon = {
      success: '✅',
      partial: '⚠️',
      failed: '❌',
      brainstorm: '💡'
    }[entry.result] || '❓';

    console.log(`${c.dim}#${entry.id}${c.reset} ${c.bold}${entry.topic}${c.reset}`);
    console.log(`   ${resultIcon} ${entry.ai} | ${date}`);
    console.log(`   ${c.dim}${entry.summary.substring(0, 80)}${entry.summary.length > 80 ? '...' : ''}${c.reset}`);
    if (entry.files.length > 0) {
      console.log(`   ${c.cyan}📁 ${entry.files.join(', ')}${c.reset}`);
    }
    console.log();
  }

  console.log(`${c.dim}Összesen: ${log.entries.length} bejegyzés${c.reset}`);
}

// ============================================
// KERESÉS
// ============================================

function searchEntries(query) {
  const log = loadLog();
  const queryLower = query.toLowerCase();

  const matches = log.entries.filter(entry =>
    entry.topic.toLowerCase().includes(queryLower) ||
    entry.summary.toLowerCase().includes(queryLower) ||
    entry.files.some(f => f.toLowerCase().includes(queryLower)) ||
    entry.ai.toLowerCase().includes(queryLower)
  );

  console.log(`\n${c.cyan}🔍 Keresés: "${query}"${c.reset}\n`);

  if (matches.length === 0) {
    console.log(`${c.yellow}Nincs találat${c.reset}`);
    return;
  }

  console.log(`${c.green}${matches.length} találat:${c.reset}\n`);

  for (const entry of matches) {
    const date = new Date(entry.timestamp).toLocaleDateString('hu-HU');
    console.log(`${c.bold}#${entry.id} ${entry.topic}${c.reset} (${entry.ai}, ${date})`);
    console.log(`   ${entry.summary}`);
    console.log();
  }
}

// ============================================
// MARKDOWN EXPORT
// ============================================

function exportToMarkdown() {
  const log = loadLog();

  let md = `# 📝 AI Chat Log - Brunella Project

Ez a fájl automatikusan generálódik. A bejegyzéseket a \`scripts/ai-chat-log.js\` kezeli.

**Utolsó frissítés:** ${new Date().toLocaleString('hu-HU')}
**Összes bejegyzés:** ${log.entries.length}

---

## Statisztika

| AI | Beszélgetések | Sikeres | Részben | Sikertelen |
|----|---------------|---------|---------|------------|
${getStats(log.entries)}

---

## Bejegyzések (legújabb elöl)

`;

  // Csoportosítás hét szerint
  const byWeek = {};
  for (const entry of log.entries) {
    const date = new Date(entry.timestamp);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];

    if (!byWeek[weekKey]) byWeek[weekKey] = [];
    byWeek[weekKey].push(entry);
  }

  const sortedWeeks = Object.keys(byWeek).sort().reverse();

  for (const week of sortedWeeks) {
    const weekDate = new Date(week);
    md += `### 📅 ${weekDate.toLocaleDateString('hu-HU', { month: 'long', day: 'numeric' })} hete\n\n`;

    for (const entry of byWeek[week].reverse()) {
      const resultIcon = {
        success: '✅',
        partial: '⚠️',
        failed: '❌',
        brainstorm: '💡'
      }[entry.result];

      const date = new Date(entry.timestamp).toLocaleDateString('hu-HU');

      md += `#### ${resultIcon} ${entry.topic}
- **AI:** ${entry.ai}
- **Dátum:** ${date}
- **Összefoglaló:** ${entry.summary}
${entry.files.length > 0 ? `- **Fájlok:** \`${entry.files.join('`, `')}\`` : ''}
${entry.nextSteps ? `- **Következő:** ${entry.nextSteps}` : ''}

`;
    }
  }

  fs.writeFileSync(LOG_MD, md);
  console.log(`${c.cyan}📄 Markdown exportálva: _AI_CHAT_LOG.md${c.reset}`);
}

function getStats(entries) {
  const stats = {};

  for (const entry of entries) {
    if (!stats[entry.ai]) {
      stats[entry.ai] = { total: 0, success: 0, partial: 0, failed: 0 };
    }
    stats[entry.ai].total++;
    if (entry.result === 'success') stats[entry.ai].success++;
    if (entry.result === 'partial') stats[entry.ai].partial++;
    if (entry.result === 'failed') stats[entry.ai].failed++;
  }

  return Object.entries(stats)
    .map(([ai, s]) => `| ${ai} | ${s.total} | ${s.success} | ${s.partial} | ${s.failed} |`)
    .join('\n');
}

// ============================================
// MAIN
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  console.log(`
${c.cyan}╔═══════════════════════════════════════╗
║     📝 BRUNELLA AI CHAT LOG           ║
║     Beszélgetés Napló                  ║
╚═══════════════════════════════════════╝${c.reset}
`);

  switch (command) {
    case 'add':
      // Parse --ai és --topic flageket
      const aiIndex = args.indexOf('--ai');
      const topicIndex = args.indexOf('--topic');
      await addEntry({
        ai: aiIndex > -1 ? args[aiIndex + 1] : null,
        topic: topicIndex > -1 ? args[topicIndex + 1] : null
      });
      break;

    case 'list':
      listEntries(parseInt(args[1]) || 20);
      break;

    case 'search':
      if (!args[1]) {
        console.log(`${c.yellow}Használat: node scripts/ai-chat-log.js search "keresőszó"${c.reset}`);
      } else {
        searchEntries(args[1]);
      }
      break;

    case 'export':
      exportToMarkdown();
      break;

    default:
      console.log(`Használat:
  ${c.cyan}add${c.reset}              Új bejegyzés hozzáadása (interaktív)
  ${c.cyan}list [n]${c.reset}         Utolsó n bejegyzés listázása (alapért.: 20)
  ${c.cyan}search "szó"${c.reset}     Keresés a bejegyzésekben
  ${c.cyan}export${c.reset}           Markdown fájl generálása

Példák:
  node scripts/ai-chat-log.js add
  node scripts/ai-chat-log.js add --ai "Claude Code" --topic "Bug fix"
  node scripts/ai-chat-log.js search "dashboard"
  node scripts/ai-chat-log.js list 10
`);
  }
}

main().catch(console.error);
