const fs = require('fs');
const file = 'src/server/middleware/federationAuth.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "import type { NextFunction, Request, Response } from 'express';",
  "import type { NextFunction, Request, Response } from 'express';\nimport * as core from 'express-serve-static-core';"
);

fs.writeFileSync(file, content);
console.log('Patched federationAuth.ts');
