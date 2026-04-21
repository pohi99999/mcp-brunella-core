/**
 * Agent skills discovery – Gemini-style: list from ~/.brunella/skills and project .brunella/skills.
 * Each skill is a directory with SKILL.md or skill.json (name, description).
 */
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface SkillMeta {
  name: string;
  description?: string;
  path: string;
}

const SKILL_MD = 'SKILL.md';
const SKILL_JSON = 'skill.json';

function readSkillMeta(dir: string, baseName: string): SkillMeta {
  const meta: SkillMeta = { name: baseName, path: dir };
  const jsonPath = path.join(dir, SKILL_JSON);
  if (fs.existsSync(jsonPath)) {
    try {
      const j = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      if (j.name) meta.name = j.name;
      if (j.description) meta.description = j.description;
    } catch {
      /* ignore */
    }
    return meta;
  }
  const mdPath = path.join(dir, SKILL_MD);
  if (fs.existsSync(mdPath)) {
    try {
      const line = fs.readFileSync(mdPath, 'utf-8').split('\n')[0];
      if (line.startsWith('# ')) meta.description = line.slice(2).trim();
    } catch {
      /* ignore */
    }
  }
  return meta;
}

/** Discover skills from configured dirs: ~/.brunella/skills, .brunella/skills in cwd. */
export function discoverSkills(skillsDir?: string, cwd?: string): SkillMeta[] {
  const home = os.homedir();
  const dirs: string[] = [];
  if (skillsDir) dirs.push(path.isAbsolute(skillsDir) ? skillsDir : path.join(cwd ?? process.cwd(), skillsDir));
  dirs.push(path.join(home, '.brunella', 'skills'));
  const c = cwd ?? process.cwd();
  dirs.push(path.join(c, '.brunella', 'skills'));

  const out: SkillMeta[] = [];
  const seen = new Set<string>();

  for (const dir of dirs) {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        const sub = path.join(dir, e.name);
        const skillPath = path.join(sub, SKILL_MD);
        const skillJson = path.join(sub, SKILL_JSON);
        if (!fs.existsSync(skillPath) && !fs.existsSync(skillJson)) continue;
        const name = e.name;
        if (seen.has(name)) continue;
        seen.add(name);
        out.push(readSkillMeta(sub, name));
      }
    } catch {
      /* skip */
    }
  }
  return out;
}
