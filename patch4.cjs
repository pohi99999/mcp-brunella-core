const fs = require('fs');
const file = 'src/server/middleware/federationAuth.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "declare module 'express-serve-static-core' {",
  "declare module 'express' {"
);

fs.writeFileSync(file, content);
console.log('Patched federationAuth.ts');
