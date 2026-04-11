const fs = require('fs');

const registryPath = 'src/server/registry.ts';
let regContent = fs.readFileSync(registryPath, 'utf8');

regContent = regContent.replace(/function unwrapZodType\(schema: z\.ZodTypeAny\): z\.ZodTypeAny \{/g, 'function unwrapZodType(schema: any): any {');

fs.writeFileSync(registryPath, regContent);

console.log('Fixed registry unwrap');
