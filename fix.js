const fs = require('fs');

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

console.log('Fixed linting errors');
