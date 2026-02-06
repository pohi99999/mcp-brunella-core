import * as fs from 'fs/promises';
import { IAgent } from './types.js';
import { DynamicAgent } from './DynamicAgent.js';
// A 'glob' csomag nincs a projektben, így a beépített 'fs' modult használom a fájlok kereséséhez.
// A '@iarna/toml' csomagot a 'package.json' tartalmazza.
// const toml = require('@iarna/toml');

class DynamicAgentLoader {
  // async loadFromTOML(path: string): Promise<IAgent> {
  //   const config = toml.parse(await fs.readFile(path, 'utf-8'));
  //   return new DynamicAgent(config);
  // }

  // async loadAllAgents(dir: string): Promise<IAgent[]> {
  //   const files = (await fs.readdir(dir)).filter(f => f.endsWith('.toml'));
  //   return Promise.all(files.map(f => this.loadFromTOML(`${dir}/${f}`)));
  // }
}
