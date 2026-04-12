import fs from 'fs';

const path = 'src/server/routes/webhooks.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace("// @ts-expect-error JSON mapping issue", "// Remove unused ts-expect-error");

fs.writeFileSync(path, content);
console.log('Fixed webhooks.ts');
