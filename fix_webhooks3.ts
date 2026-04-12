import fs from 'fs';

const path = 'src/server/routes/webhooks.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace("// @ts-expect-error type mismatches with older definitions", "");

fs.writeFileSync(path, content);
console.log('Fixed webhooks.ts');
