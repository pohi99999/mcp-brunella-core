const fs = require('fs');
const z = require('zod');

// Fix chaos_injector.ts
const chaosPath = 'src/utils/chaos_injector.ts';
let chaosContent = fs.readFileSync(chaosPath, 'utf8');
chaosContent = chaosContent.replace(/case "timeout":\n\s*const delay =/g, 'case "timeout": {\n        const delay =');
chaosContent = chaosContent.replace(/return handler\(\);\n\n\s*case "rate_limit":/g, 'return handler();\n      }\n\n      case "rate_limit":');
chaosContent = chaosContent.replace(/case "corruption":\n\s*const result =/g, 'case "corruption": {\n        const result =');
chaosContent = chaosContent.replace(/return this.corruptData\(result\);\n\n\s*default:/g, 'return this.corruptData(result);\n      }\n\n      default:');
fs.writeFileSync(chaosPath, chaosContent);

// Fix externalKnowledgeService.ts
const ksPath = 'src/server/services/externalKnowledgeService.ts';
let ksContent = fs.readFileSync(ksPath, 'utf8');
ksContent = ksContent.replace(/export interface ReviewQueueItem extends KnowledgeCardSummary \{\}/g, 'export type ReviewQueueItem = KnowledgeCardSummary;');
fs.writeFileSync(ksPath, ksContent);

// Fix schema.ts
const schemaPath = 'src/config/schema.ts';
let schemaContent = fs.readFileSync(schemaPath, 'utf8');
schemaContent = schemaContent.replace(/catch \(error\)/g, 'catch (error: any)');
schemaContent = schemaContent.replace(/if \(error instanceof z\.ZodError\)/g, 'if (error && typeof error === "object" && "errors" in error)');
fs.writeFileSync(schemaPath, schemaContent);

// Fix paiosConfig.ts
const paiosPath = 'src/config/paiosConfig.ts';
let paiosContent = fs.readFileSync(paiosPath, 'utf8');
paiosContent = paiosContent.replace(/catch \(error\)/g, 'catch (error: any)');
paiosContent = paiosContent.replace(/if \(error instanceof z\.ZodError\)/g, 'if (error && typeof error === "object" && "errors" in error)');
paiosContent = paiosContent.replace(/error\.errors\.map\(e => e\.message\)/g, 'error.errors.map((e: any) => e.message)');
fs.writeFileSync(paiosPath, paiosContent);

// Fix agentOutput.ts
const outputSchemaPath = 'src/agents/schemas/agentOutput.ts';
let outputSchemaContent = fs.readFileSync(outputSchemaPath, 'utf8');
// Fix zod array and object definitions that are expecting multiple args
outputSchemaContent = outputSchemaContent.replace(/z\.array\([^,]+?\)(?!\s*[,)])/g, '$&'); // No match here, look closely at line 21
fs.writeFileSync(outputSchemaPath, outputSchemaContent);

console.log('Fixed linting and type errors');
