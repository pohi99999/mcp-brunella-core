import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { discoverSkills } from '@packages/utils/skillsLoader.js';

describe('Skills loader', () => {
  it('discoverSkills returns array', () => {
    const skills = discoverSkills(undefined, process.cwd());
    expect(Array.isArray(skills)).toBe(true);
  });

  it('discoverSkills finds skill dir with SKILL.md in given dir', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brunella-skills-'));
    try {
      const skillDir = path.join(tmp, 'my-skill');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# my-skill\nDo stuff.\n', 'utf-8');
      const skills = discoverSkills(tmp, tmp);
      expect(skills.length).toBeGreaterThanOrEqual(1);
      const s = skills.find((x) => x.name === 'my-skill');
      expect(s).toBeDefined();
      expect(s!.path.includes('my-skill')).toBe(true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('discoverSkills finds skill dir with skill.json', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brunella-skills-'));
    try {
      const skillDir = path.join(tmp, 'json-skill');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(
        path.join(skillDir, 'skill.json'),
        JSON.stringify({ name: 'JsonSkill', description: 'From JSON' }),
        'utf-8'
      );
      const skills = discoverSkills(tmp, tmp);
      const s = skills.find((x) => x.name === 'json-skill' || x.name === 'JsonSkill');
      expect(s).toBeDefined();
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});