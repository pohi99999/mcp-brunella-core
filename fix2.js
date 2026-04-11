const fs = require('fs');

// Fix paiosConfig.ts
const paiosPath = 'src/config/paiosConfig.ts';
let paiosContent = fs.readFileSync(paiosPath, 'utf8');
paiosContent = paiosContent.replace(/catch \(e\) {/g, 'catch (e: any) {');
paiosContent = paiosContent.replace(/if \(e instanceof ZodError\) {/g, 'if (e && e.name === "ZodError") {');
fs.writeFileSync(paiosPath, paiosContent);

// Fix schema.ts
const schemaPath = 'src/config/schema.ts';
let schemaContent = fs.readFileSync(schemaPath, 'utf8');
schemaContent = schemaContent.replace(/catch \(e\) {/g, 'catch (e: any) {');
schemaContent = schemaContent.replace(/if \(e instanceof ZodError\) {/g, 'if (e && e.name === "ZodError") {');
fs.writeFileSync(schemaPath, schemaContent);

console.log('Fixed zod errors');
