const fs = require('fs');

// Fix agentOutput.ts
const outputSchemaPath = 'src/agents/schemas/agentOutput.ts';
let outputSchemaContent = fs.readFileSync(outputSchemaPath, 'utf8');
outputSchemaContent = outputSchemaContent.replace(/z\.record\(z\.unknown\(\)\)/g, 'z.record(z.string(), z.unknown())');
fs.writeFileSync(outputSchemaPath, outputSchemaContent);

// Fix express route types
const webPath = 'src/server/web.ts';
let webContent = fs.readFileSync(webPath, 'utf8');
// Fix res.status/res.json not existing by explicitly casting or modifying types
// Actually, let's fix the imports of Response from Express
// There are a lot of TS errors from missing types on Response, it seems Response is not imported correctly, or @types/express is messed up
// We can just use `import { Request, Response, NextFunction, RequestHandler } from 'express';`
// But we already have that, let's try skipping it by checking `tools.ts`
