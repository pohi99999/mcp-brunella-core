const fs = require('fs');
const path = require('path');
const glob = require('glob');

// This helper is a copy of .worktrees/Képességek/generate_kepessegek_expand.cjs
// adjusted to run from the repository root (repoRoot = __dirname)

const repoRoot = path.resolve(__dirname);
const skillsRoot = path.join(repoRoot, '.agents', 'skills');
const outPath = path.join(repoRoot, '.worktrees', 'kepessegek.md');

function parseFrontMatter(content) {
  const m = content.match(/^---\s*([\s\S]*?)\s*---/);
  if (!m) return {};
  const fm = m[1];
  const lines = fm.split(/\r?\n/);
  const obj = {};
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const kv = line.match(/^(\s*[^:]+)\s*:\s*(.*)$/);
    if (!kv) continue;
    let key = kv[1].trim();
    let value = kv[2].trim();
    if (key === 'description' && (/^\>[-|]?$/.test(value) || value === '|' || value === '>-')) {
      // block style: collect subsequent indented lines
      let descLines = [];
      let j = i + 1;
      for (; j < lines.length; j++) {
        if (/^\s{2,}/.test(lines[j])) descLines.push(lines[j].replace(/^\s+/, ''));
        else if (lines[j].trim() === '') descLines.push('');
        else break;
      }
      obj.description = descLines.join(' ').trim();
      i = j - 1;
    } else {
      obj[key] = value.replace(/^\"|\"$/g, '').replace(/^\'|\'$/g, '').trim();
    }
  }
  return obj;
}

function autoParagraphForSkill(s) {
  const name = s.name || 'Név nélküli skill';
  const cat = s.category || 'Általános';
  const ver = s.version || '—';
  const short = s.description || 'Rövid leírás nem található.';
  return `A "${name}" skill (${cat}, verzió: ${ver}) — automatikusan generált részletes leírás: ${short} Javasolt felhasználási terület: integrációk és automatizálási feladatok, ahol külső szolgáltatásokkal kell kommunikálni vagy adatok feldolgozását kell végezni. Példa használat: hívj meg egy API végpontot, dolgozd fel a választ, és tárold/használd fel az eredményt továbbfolyamatokban. (Automatikus leírás — kérlek ellenőrizd és pontosítsd kézzel.)`;
}

function autoParagraphForAgent(a) {
  const name = a.name || 'Név nélküli agent';
  const title = a.title || name;
  const desc = a.description || 'Nincs részletes leírás.';
  const caps = (a.capabilities && a.capabilities.length) ? a.capabilities.join(', ') : 'Nincsenek felsorolva képességek.';
  return `Az ügynök "${title}" (${name}) rövid leírása: ${desc} Képességek: ${caps}. Használati javaslat: futtatható automatizált munkafolyamatok részeként, ahol a felsorolt képességek relevánsak. (Automatikusan generált szöveg — kérjük, tekintsd át.)`;
}

let skills = [];
try {
  const skillFiles = glob.sync('**/SKILL.md', { cwd: skillsRoot, nodir: true });
  for (const rel of skillFiles) {
    const full = path.join(skillsRoot, rel);
    try {
      const content = fs.readFileSync(full, 'utf8');
      const fm = parseFrontMatter(content);
      skills.push({
        file: path.relative(repoRoot, full),
        name: fm.name || path.basename(path.dirname(full)),
        description: fm.description || '',
        category: fm.category || fm.categories || '',
        version: fm.version || ''
      });
    } catch (e) {
      // ignore per-file error
    }
  }
} catch (e) {
  // ignore
}

let agents = [];
try {
  const regPath = path.join(repoRoot, 'src', 'agents', 'registry.json');
  const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
  agents = reg.agents || [];
} catch (e) {
  // ignore
}

let pluginDirs = new Set();
let pluginSamples = {};
try {
  const allFiles = glob.sync('**/*', { cwd: repoRoot, nodir: true, dot: true });
  for (const f of allFiles) {
    const idx = f.indexOf('plugins');
    if (idx !== -1) {
      const seg = f.substring(0, idx + 'plugins'.length);
      const normalized = seg.replace(/\\\\/g, '/').replace(/\\/g, '/');
      pluginDirs.add(normalized);
    }
  }
  for (const p of pluginDirs) {
    let samples = glob.sync(path.join(p, '**/*.{js,ts,py,md}'), { cwd: repoRoot, nodir: true }).slice(0,5);
    pluginSamples[p] = samples.map(s=>s.replace(/\\\\/g,'/'));
  }
} catch (e) {
  // ignore
}

let md = `# Képességek (automatikusan finomított)\n\n`;
md += `Ez a fájl automatikusan generált, kiegészített változata. Minden bekezdés automatikusan jött létre a SKILL.md frontmatter és az agent registry alapján — kérem, ellenőrizd és pontosítsd kézzel, ha szükséges.\n\n`;
md += `## Skills (részletes, automatikus)\n\n`;
skills.sort((a,b)=>a.name.localeCompare(b.name));
for (const s of skills) {
  md += `### ${s.name}\n- Kategória: ${s.category || '—'}\n- Verzió: ${s.version || '—'}\n- Forrás: ${s.file}\n\n`;
  md += `**Részletes leírás (automatikus):**\n${autoParagraphForSkill(s)}\n\n`;
}

md += `## Agents (részletes, automatikus)\n\n`;
for (const a of agents) {
  md += `### ${a.title || a.name} (${a.name})\n`;
  if (a.class) md += `- Osztály: ${a.class}\n`;
  if (a.module) md += `- Modul: ${a.module}\n`;
  md += `- Forrás: src/agents/registry.json\n\n`;
  md += `**Részletes leírás (automatikus):**\n${autoParagraphForAgent(a)}\n\n`;
}

md += `## Plugins (talált könyvtárak és mintafájlok)\n\n`;
for (const p of Array.from(pluginDirs).sort()) {
  md += `### ${p}\n`;
  const samples = pluginSamples[p] || [];
  if (samples.length) {
    md += `Mintafájlok: \n`;
    for (const s of samples) md += `- ${s}\n`;
  } else {
    md += `- (nincs gyors mintafájl)\n`;
  }
  md += `\n`;
}

md += `\n---\nMegjegyzés: ez egy automatikus, gyors finomítás. A pontos, használatra kész dokumentációhoz javasolt kézi szerkesztés és tesztpéldák hozzáadása.\n`;

try {
  fs.writeFileSync(outPath, md, 'utf8');
  console.log('WROTE', outPath);
} catch (e) {
  console.error('ERR', e && e.message);
  process.exit(2);
}
