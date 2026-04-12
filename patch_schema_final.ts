import fs from 'fs';

let path = 'src/config/schema.ts';
let content = fs.readFileSync(path, 'utf8');
content = content.replace('const formattedErrors = error.errors.map(', 'const formattedErrors = (error as any).errors.map(');
fs.writeFileSync(path, content);
console.log('Patched schema.ts');

path = 'src/config/paiosConfig.ts';
content = fs.readFileSync(path, 'utf8');
content = content.replace('JSON.stringify(error.errors)', 'JSON.stringify((error as any).errors)');
content = content.replace('error.errors.map(e =>', '(error as any).errors.map((e: any) =>');
fs.writeFileSync(path, content);
console.log('Patched paiosConfig.ts');

path = 'src/agents/schemas/agentOutput.ts';
content = fs.readFileSync(path, 'utf8');
content = content.replace(/z\.record\(z\.unknown\(\)\)/g, 'z.record(z.string(), z.unknown())');
fs.writeFileSync(path, content);
console.log('Patched agentOutput.ts');
