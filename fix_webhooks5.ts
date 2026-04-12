import fs from 'fs';

const path = 'src/server/routes/webhooks.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace("   - rawBody added by middleware", "// - rawBody added by middleware");

fs.writeFileSync(path, content);
console.log('Fixed webhooks.ts');
