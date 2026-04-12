const fs = require('fs');

// Patch chaos_injector.ts
const chaosPath = 'src/utils/chaos_injector.ts';
if (fs.existsSync(chaosPath)) {
  let content = fs.readFileSync(chaosPath, 'utf-8');
  content = content.replace('case "timeout":\n        const delay =', 'case "timeout": {\n        const delay =');
  content = content.replace('return handler();\n\n      case "rate_limit":', 'return handler();\n      }\n\n      case "rate_limit":');
  content = content.replace('case "corruption":\n        const result =', 'case "corruption": {\n        const result =');
  content = content.replace('return this.corruptData(result);\n\n      default:', 'return this.corruptData(result);\n      }\n\n      default:');
  fs.writeFileSync(chaosPath, content);
  console.log('Patched chaos_injector.ts');
}

// Patch externalKnowledgeService.ts
const extKnowledgePath = 'src/server/services/externalKnowledgeService.ts';
if (fs.existsSync(extKnowledgePath)) {
  let content = fs.readFileSync(extKnowledgePath, 'utf-8');
  content = content.replace('export interface ReviewQueueItem extends KnowledgeCardSummary {}', 'export type ReviewQueueItem = KnowledgeCardSummary;');
  fs.writeFileSync(extKnowledgePath, content);
  console.log('Patched externalKnowledgeService.ts');
}
