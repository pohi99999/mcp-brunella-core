const fs = require('fs');

const registryPath = 'src/server/registry.ts';
let regContent = fs.readFileSync(registryPath, 'utf8');
regContent = regContent.replace(/getZodTypeString\(\(schema\._def as any\)\.innerType\)/g, 'getZodTypeString((schema as any)._def.innerType)');
regContent = regContent.replace(/getZodTypeString\(\(schema\._def as any\)\.type\)/g, 'getZodTypeString((schema as any)._def.type)');
regContent = regContent.replace(/getZodTypeString\(\(schema as any\)\._def\.schema\)/g, 'getZodTypeString((schema as any)._def.schema)');
// And the record fix again
regContent = regContent.replace(/z\.record\(z\.any\(\)\)/g, 'z.record(z.string(), z.any())');
fs.writeFileSync(registryPath, regContent);

const n8nPath = 'src/tools/n8n.ts';
let n8nContent = fs.readFileSync(n8nPath, 'utf8');
n8nContent = n8nContent.replace(/z\.record\(z\.any\(\)\)/g, 'z.record(z.string(), z.any())');
fs.writeFileSync(n8nPath, n8nContent);

console.log('Fixed final TS errors');
