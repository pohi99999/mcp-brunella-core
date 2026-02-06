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

async function readSkillMeta(dir: string, baseName: string): Promise<SkillMeta> {
  const meta: SkillMeta = { name: baseName, path: dir };
  const jsonPath = path.join(dir, SKILL_JSON);

  try {
    const content = await fs.promises.readFile(jsonPath, 'utf-8');
    try {
      const j = JSON.parse(content);
      if (j.name) meta.name = j.name;
      if (j.description) meta.description = j.description;
    } catch {
      /* ignore JSON parse error */
    }
    return meta;
  } catch (e: any) {
    if (e.code !== 'ENOENT') {
      // Ignore
    }
  }

  const mdPath = path.join(dir, SKILL_MD);
  try {
    const content = await fs.promises.readFile(mdPath, 'utf-8');
    const line = content.split('\n')[0];
    if (line.startsWith('# ')) meta.description = line.slice(2).trim();
  } catch {
    /* ignore */
  }
  return meta;
}

/** Discover skills from configured dirs: ~/.brunella/skills, .brunella/skills in cwd. */
export async function discoverSkills(skillsDir?: string, cwd?: string): Promise<SkillMeta[]> {
  const home = os.homedir();
  const dirs: string[] = [];
  if (skillsDir) dirs.push(path.isAbsolute(skillsDir) ? skillsDir : path.join(cwd ?? process.cwd(), skillsDir));
  dirs.push(path.join(home, '.brunella', 'skills'));
  const c = cwd ?? process.cwd();
  dirs.push(path.join(c, '.brunella', 'skills'));

  const seen = new Set<string>();
  const validSkills: { dir: string; name: string }[] = [];

  const dirResults = await Promise.all(dirs.map(async (dir) => {
    try {
      const stats = await fs.promises.stat(dir);
      if (!stats.isDirectory()) return [];

      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      const dirsToProcess = entries.filter(e => e.isDirectory());
      const skillsInDir: { dir: string, name: string }[] = [];

      // Process in chunks to avoid overwhelming the system
      const CHUNK_SIZE = 50;
      for (let i = 0; i < dirsToProcess.length; i += CHUNK_SIZE) {
        const chunk = dirsToProcess.slice(i, i + CHUNK_SIZE);
        const chunkResults = await Promise.all(chunk.map(async (e) => {
          const sub = path.join(dir, e.name);
          const skillPath = path.join(sub, SKILL_MD);
          const skillJson = path.join(sub, SKILL_JSON);
          try {
            await fs.promises.access(skillPath).catch(() => fs.promises.access(skillJson));
            return { dir: sub, name: e.name };
          } catch {
            return null;
          }
        }));
        skillsInDir.push(...chunkResults.filter((s): s is { dir: string, name: string } => s !== null));
      }

      return skillsInDir;
    } catch {
      return [];
    }
  }));

  for (const group of dirResults) {
    for (const skill of group) {
      if (!seen.has(skill.name)) {
        seen.add(skill.name);
        validSkills.push(skill);
      }
    }
  }

  // Also chunk the reading of metadata
  const results: SkillMeta[] = [];
  const CHUNK_SIZE = 50;
  for (let i = 0; i < validSkills.length; i += CHUNK_SIZE) {
      const chunk = validSkills.slice(i, i + CHUNK_SIZE);
      const chunkResults = await Promise.all(chunk.map(s => readSkillMeta(s.dir, s.name)));
      results.push(...chunkResults);
  }

  return results;
}
