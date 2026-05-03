import fs from 'node:fs';

fs.mkdirSync('build', { recursive: true });
fs.writeFileSync('build/cli.js', "#!/usr/bin/env node\nimport './apps/mcp-core/cli.js';\n");
