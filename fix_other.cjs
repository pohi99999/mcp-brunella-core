const fs = require('fs');

// Fix config schema
const schemaPath = 'src/config/schema.ts';
let schemaContent = fs.readFileSync(schemaPath, 'utf8');
schemaContent = schemaContent.replace(/\(e\) => `  - \$\{e.path/g, '(e: any) => `  - ${e.path');
fs.writeFileSync(schemaPath, schemaContent);

// Fix hrTimesheet
const timesheetPath = 'src/server/routes/hrTimesheet.ts';
let timesheetContent = fs.readFileSync(timesheetPath, 'utf8');
timesheetContent = timesheetContent.replace(/error instanceof z\.ZodError/g, 'error && typeof error === "object" && "errors" in error');
fs.writeFileSync(timesheetPath, timesheetContent);

// Fix tools/n8n.ts
const n8nPath = 'src/tools/n8n.ts';
let n8nContent = fs.readFileSync(n8nPath, 'utf8');
n8nContent = n8nContent.replace(/z\.array\([^,]+?\)(?!\s*[,)])/g, '$&'); // Actually it is ZodSchema
n8nContent = n8nContent.replace(/z\.record\(z\.unknown\(\)\)/g, 'z.record(z.string(), z.unknown())');
fs.writeFileSync(n8nPath, n8nContent);

// Fix taskManagement.ts
const tmPath = 'src/tools/taskManagement.ts';
let tmContent = fs.readFileSync(tmPath, 'utf8');
tmContent = tmContent.replace(/z\.record\(z\.unknown\(\)\)/g, 'z.record(z.string(), z.unknown())');
fs.writeFileSync(tmPath, tmContent);

// Fix registry.ts
const registryPath = 'src/server/registry.ts';
let regContent = fs.readFileSync(registryPath, 'utf8');
regContent = regContent.replace(/z\.record\(z\.unknown\(\)\)/g, 'z.record(z.string(), z.unknown())');
// Any other Zod issues in registry.ts: ZodEffects, $ZodType
// we will just replace the import if it's broken, or let it fail for now if it requires complex generic fixes.
// Wait, TS says Argument of type '$ZodType...' is not assignable to 'ZodType...'
// We can use 'any' in registry.ts registerTool definition
regContent = regContent.replace(/parameters: z\.ZodType<any>/g, 'parameters: any');
regContent = regContent.replace(/execute: \(args: z\.infer<typeof parameters>\)/g, 'execute: (args: any)');
regContent = regContent.replace(/if \(schema instanceof z\.ZodEffects\) \{/g, 'if (schema && (schema as any)._def && (schema as any)._def.typeName === "ZodEffects") {');
regContent = regContent.replace(/return getZodTypeString\(schema\._def\.schema\)/g, 'return getZodTypeString((schema as any)._def.schema)');
fs.writeFileSync(registryPath, regContent);

console.log('Fixed additional typescript errors');
