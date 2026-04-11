const fs = require('fs');

const registryPath = 'src/server/registry.ts';
let regContent = fs.readFileSync(registryPath, 'utf8');

// Replace zodType references in the registry recursive stringifier entirely with 'any' since it seems to be heavily conflicting
regContent = regContent.replace(/function getZodTypeString\(schema: any\): string \{/g, 'function getZodTypeString(schema: any): string {');

// Fix lines 60, 64 type parameters
// Argument of type '$ZodType...' is not assignable to parameter of type 'ZodType...'
// So let's find the `getZodTypeString(schema._def.innerType)` etc and cast
regContent = regContent.replace(/getZodTypeString\(schema\._def\.innerType\)/g, 'getZodTypeString((schema._def as any).innerType)');
regContent = regContent.replace(/getZodTypeString\(\(schema as any\)\._def\.schema\)/g, 'getZodTypeString((schema as any)._def.schema)');
regContent = regContent.replace(/getZodTypeString\(schema\._def\.type\)/g, 'getZodTypeString((schema._def as any).type)');

// Line 644
regContent = regContent.replace(/z\.record\(z\.unknown\(\)\)/g, 'z.record(z.string(), z.unknown())');

fs.writeFileSync(registryPath, regContent);

const n8nPath = 'src/tools/n8n.ts';
let n8nContent = fs.readFileSync(n8nPath, 'utf8');
n8nContent = n8nContent.replace(/z\.record\(z\.unknown\(\)\)/g, 'z.record(z.string(), z.unknown())');
fs.writeFileSync(n8nPath, n8nContent);

console.log('Fixed registry');
