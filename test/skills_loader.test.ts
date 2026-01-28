import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { discoverSkills } from '../src/utils/skillsLoader.js';

describe('Skills loader', () => {
  it('discoverSkills returns array', () => {
    const skills = discoverSkills(undefined, process.cwd());
    assert.ok(Array.isArray(skills));
  });

  it('discoverSkills finds skill dir with SKILL.md in given dir', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brunella-skills-'));
    try {
      const skillDir = path.join(tmp, 'my-skill');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# my-skill\nDo stuff.\n', 'utf-8');
      const skills = discoverSkills(tmp, tmp);
      assert.ok(skills.length >= 1);
      const s = skills.find((x) => x.name === 'my-skill');
      assert.ok(s);
      assert.ok(s!.path.includes('my-skill'));
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
      assert.ok(s);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
