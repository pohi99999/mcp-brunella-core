#!/usr/bin/env node
// scripts/continual-learning-init.mjs
//
// Brunella Continual Learning — Bootstrap & Management CLI
//
// Parancsok:
//   node scripts/continual-learning-init.mjs inject          # Tanulságok kiírása (munkamenet indításakor)
//   node scripts/continual-learning-init.mjs inject --critical  # Csak kritikus tanulságok
//   node scripts/continual-learning-init.mjs add             # Interaktív learning hozzáadás
//   node scripts/continual-learning-init.mjs compact         # Régi/alacsony-hit learningek prune-olása
//   node scripts/continual-learning-init.mjs list            # Összes learning kilistázása
//   node scripts/continual-learning-init.mjs session <title> # Munkamenet befejezés logolása

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const memoryDir = join(repoRoot, '.copilot-memory');
const learningsFile = join(memoryDir, 'learnings.json');
const conventionsFile = join(memoryDir, 'conventions.md');
const sessionLogFile = join(memoryDir, 'session-log.md');

// ─── Segédfüggvények ──────────────────────────────────────────────────────────

function ensureMemoryDir() {
  if (!existsSync(memoryDir)) {
    mkdirSync(memoryDir, { recursive: true });
    console.log('[CL] .copilot-memory/ mappa létrehozva.');
  }
}

function loadLearnings() {
  if (!existsSync(learningsFile)) return { _meta: {}, learnings: [], session_stats: { total_sessions: 0, last_session: null, total_learnings: 0, categories: {} } };
  return JSON.parse(readFileSync(learningsFile, 'utf8'));
}

function saveLearnings(data) {
  writeFileSync(learningsFile, JSON.stringify(data, null, 2), 'utf8');
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function nextId(learnings) {
  if (learnings.length === 0) return 'L001';
  const ids = learnings.map(l => parseInt(l.id.replace('L', ''), 10)).filter(n => !isNaN(n));
  const max = Math.max(...ids);
  return `L${String(max + 1).padStart(3, '0')}`;
}

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const CATEGORY_ICON = { mistake: '❌', convention: '📐', pattern: '🔄', tool_insight: '🔧', preference: '⭐' };

// ─── Parancsok ──────────────────────────────────────────────────────────────

const [,, command, ...args] = process.argv;

switch (command) {

  // ── INJECT: munkamenet elején futtatandó ──────────────────────────────────
  case 'inject':
  case undefined: {
    const criticalOnly = args.includes('--critical');
    const data = loadLearnings();

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║  BRUNELLA CONTINUAL LEARNING — MUNKAMENET KONTEXTUS          ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    // Conventions kivonat
    if (existsSync(conventionsFile)) {
      const lines = readFileSync(conventionsFile, 'utf8').split('\n');
      const criticalLines = [];
      let inCritical = false;
      for (const line of lines) {
        if (line.startsWith('## 🔴') || line.startsWith('## 🟠')) inCritical = true;
        if (line.startsWith('## 🟡') || line.startsWith('## 🔵') || line.startsWith('## 🟢') || line.startsWith('## ⚙️') || line.startsWith('## 🧪') || line.startsWith('## 📦') || line.startsWith('## 📝')) inCritical = false;
        if (inCritical && line.trim()) criticalLines.push(line);
      }
      console.log('📋 KRITIKUS KONVENCIÓK:');
      console.log('─'.repeat(60));
      criticalLines.slice(0, 20).forEach(l => console.log(l));
      console.log('');
    }

    // Learnings inject
    const filtered = data.learnings
      .filter(l => criticalOnly ? l.priority === 'critical' : ['critical', 'high'].includes(l.priority))
      .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9));

    console.log(`🎯 PRIORITÁSOS TANULSÁGOK (${filtered.length} db):`);
    console.log('─'.repeat(60));
    for (const l of filtered) {
      const icon = CATEGORY_ICON[l.category] ?? '•';
      console.log(`  [${l.id}] ${icon} [${l.priority.toUpperCase()}] ${l.content}`);
      console.log('');
    }

    console.log('─'.repeat(60));
    console.log(`📊 ${data.learnings.length} learning | Utolsó: ${data.session_stats.last_session ?? 'nincs'}`);
    console.log('💡 Összes: node scripts/continual-learning-init.mjs list');
    console.log('💡 Hozzáadás: node scripts/continual-learning-init.mjs add\n');

    // Session stats frissítés
    data.session_stats.total_sessions = (data.session_stats.total_sessions ?? 0) + 1;
    data.session_stats.last_session = today();
    saveLearnings(data);
    break;
  }

  // ── LIST: összes learning kilistázása ─────────────────────────────────────
  case 'list': {
    const data = loadLearnings();
    const byPriority = [...data.learnings].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9));
    console.log(`\n📚 BRUNELLA LEARNINGS — ${byPriority.length} db összesen\n`);
    for (const l of byPriority) {
      const icon = CATEGORY_ICON[l.category] ?? '•';
      console.log(`[${l.id}] ${icon} [${l.priority.toUpperCase()}/${l.category}] hits:${l.hit_count}`);
      console.log(`    ${l.content}`);
      console.log('');
    }
    break;
  }

  // ── ADD: interaktív learning hozzáadás ────────────────────────────────────
  case 'add': {
    const data = loadLearnings();
    // Readline-alapú interaktív input
    const rl = (await import('readline')).createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q) => new Promise(r => rl.question(q, r));

    console.log('\n➕ ÚJ LEARNING HOZZÁADÁSA\n');
    const content = await ask('Tartalom (mit tanultunk): ');
    const category = await ask('Kategória (mistake/convention/pattern/tool_insight/preference): ') || 'convention';
    const priority = await ask('Prioritás (critical/high/medium/low) [default: medium]: ') || 'medium';
    const source = await ask('Forrás (pl. build_failure, session_observation, user_correction): ') || 'manual';
    rl.close();

    const newLearning = {
      id: nextId(data.learnings),
      scope: 'local',
      category,
      priority,
      content,
      source,
      created: today(),
      last_hit: today(),
      hit_count: 1
    };
    data.learnings.push(newLearning);
    data.session_stats.total_learnings = data.learnings.length;
    data.session_stats.categories[category] = (data.session_stats.categories[category] ?? 0) + 1;
    saveLearnings(data);
    console.log(`\n✅ Learning hozzáadva: [${newLearning.id}] ${newLearning.content}\n`);
    break;
  }

  // ── SESSION: munkamenet log bejegyzés ─────────────────────────────────────
  case 'session': {
    const title = args.join(' ') || 'Névtelen munkamenet';
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const entry = `\n### ${timestamp} — ${title}\n**Feladat:** \n**Érintett fájlok:** \n**Állapot:** ✅ Befejezve\n**Tanulság:** \n**Új learning ID:** —\n`;
    if (existsSync(sessionLogFile)) {
      const content = readFileSync(sessionLogFile, 'utf8');
      const insertAt = content.indexOf('\n## Munkamenetek\n') + '\n## Munkamenetek\n'.length;
      const updated = content.slice(0, insertAt) + entry + content.slice(insertAt);
      writeFileSync(sessionLogFile, updated, 'utf8');
    }
    console.log(`✅ Session log bejegyzés hozzáadva: ${timestamp} — ${title}`);
    break;
  }

  // ── COMPACT: régi/alacsony-hit learningek prune-olása ────────────────────
  case 'compact': {
    const data = loadLearnings();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (data._meta?.compaction_policy?.prune_after_days ?? 60));
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const before = data.learnings.length;
    data.learnings = data.learnings.filter(l => {
      if (['critical', 'high'].includes(l.priority)) return true; // kritikus/magas mindig marad
      if (l.hit_count >= 3) return true; // sokat hivatkozott marad
      if (l.last_hit >= cutoffStr) return true; // frissen használt marad
      return false;
    });
    const pruned = before - data.learnings.length;
    data.session_stats.total_learnings = data.learnings.length;
    saveLearnings(data);
    console.log(`\n🗑️  Compact kész: ${pruned} learning eltávolítva, ${data.learnings.length} megmaradva.\n`);
    break;
  }

  default:
    console.log(`
Brunella Continual Learning — Parancsok:

  node scripts/continual-learning-init.mjs inject          Tanulságok injektálása (munkamenet indításakor)
  node scripts/continual-learning-init.mjs inject --critical  Csak kritikus
  node scripts/continual-learning-init.mjs list            Összes learning listázása
  node scripts/continual-learning-init.mjs add             Interaktív learning hozzáadás
  node scripts/continual-learning-init.mjs session <cím>   Munkamenet befejezés logolása
  node scripts/continual-learning-init.mjs compact         Régi/alacsony-hit learningek prune-olása
`);
}
