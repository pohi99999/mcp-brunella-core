const fs = require('fs');

const registryPath = 'src/server/registry.ts';
let regContent = fs.readFileSync(registryPath, 'utf8');
regContent = regContent.replace(/function getZodTypeString\(schema: z\.ZodType<any>\): string \{/g, 'function getZodTypeString(schema: any): string {');
fs.writeFileSync(registryPath, regContent);

const n8nPath = 'src/tools/n8n.ts';
let n8nContent = fs.readFileSync(n8nPath, 'utf8');
n8nContent = n8nContent.replace(/parameters: z\.record\(z\.unknown\(\)\)/g, 'parameters: z.record(z.string(), z.unknown())');
fs.writeFileSync(n8nPath, n8nContent);

const rPath = 'src/server/registry.ts';
let rContent = fs.readFileSync(rPath, 'utf8');
rContent = rContent.replace(/parameters: z\.record\(z\.unknown\(\)\)/g, 'parameters: z.record(z.string(), z.unknown())');
fs.writeFileSync(rPath, rContent);

console.log('Fixed registry');
