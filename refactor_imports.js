
import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';

const testsDir = 'f:/mcp-brunella-core/tests';
const files = globSync('f:/mcp-brunella-core/tests/**/*.{ts,tsx,js,jsx}');

const mappings = [
  {
    regex: /(['"])(\.\.\/)*src\/(core|server|orchestration|orchestrator|kernel)\//g,
    replacement: '$1@packages/core-logic/'
  },
  {
    regex: /(['"])(\.\.\/)*src\/agents\//g,
    replacement: '$1@packages/agents/'
  },
  {
    regex: /(['"])(\.\.\/)*src\/(utils|lib|config)\//g,
    replacement: '$1@packages/utils/'
  },
  {
    regex: /(['"])(\.\.\/)*src\/(types|schemas)\//g,
    replacement: '$1@packages/types/'
  },
  {
    regex: /(['"])(\.\.\/)*src\/(database|data)\//g,
    replacement: '$1@packages/database/'
  },
  {
    regex: /(['"])(\.\.\/)*src\/dashboard\//g,
    replacement: '$1@apps/dashboard/'
  },
  {
    regex: /(['"])(\.\.\/)*src\/cloudflare\//g,
    replacement: (match, quote) => {
      // Basic context check: if it's already under some cloudflare specific test or path
      // But user said "@apps/cloudflare-edge/" or "@packages/core-logic/cloudflare/"
      // I'll default to @apps/cloudflare-edge/ unless it seems like a core logic thing.
      // Looking at the grep results, most seem to be in test/cloudflare_...
      return quote + '@apps/cloudflare-edge/';
    }
  }
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  mappings.forEach(mapping => {
    const newContent = content.replace(mapping.regex, mapping.replacement);
    if (newContent !== content) {
      content = newContent;
      changed = true;
    }
  });

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated: ${file}`);
  }
});
