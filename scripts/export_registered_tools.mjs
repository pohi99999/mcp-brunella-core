#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';

(async () => {
  try {
    const registryPath = path.join(process.cwd(), 'build', 'server', 'registry.js');
    try {
      const mod = await import('file://' + registryPath);
      if (!mod.getRegisteredToolsList) {
        console.error('getRegisteredToolsList not exported from built registry:', registryPath);
        process.exit(2);
      }
      const list = mod.getRegisteredToolsList();
      await fs.mkdir(path.join(process.cwd(), 'out'), { recursive: true });
      await fs.writeFile(path.join(process.cwd(), 'out', 'tools.json'), JSON.stringify(list, null, 2), 'utf8');
      console.log('Wrote out/tools.json (from built registry).');
      process.exit(0);
    } catch (e) {
      console.error('Failed to import built registry. Run `npm run build` first.\nError:', e.message);
      process.exit(1);
    }
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
})();
