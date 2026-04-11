const fs = require('fs');

const filesToFix = [
  'src/server/routes/szamlazz.ts',
  'src/server/routes/testScheduler.ts',
  'src/server/routes/webhooks.ts',
  'src/server/routes/workers.ts',
  'src/server/routes/wrangler.ts',
  'src/server/routes/zeroPrompt.ts',
  'src/server/routes/scaling.ts',
  'src/server/routes/scheduledTasks.ts',
  'src/server/routes/robotkez.ts'
];

for (const file of filesToFix) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');

    // Remove duplicate `import { Request, Response, NextFunction } from 'express';` at the top
    // that we accidentally added to files that already had it.
    // The previous script added it right at the top unconditionally if 'import express' was not present.
    content = content.replace(/^import { Request, Response, NextFunction } from 'express';\n/, '');

    // Also fix webhooks.ts rawBody issue
    if (file.includes('webhooks.ts')) {
        content = content.replace(/const rawBody = req\.rawBody as Buffer \| string \| undefined;/g, 'const rawBody = (req as any).rawBody as Buffer | string | undefined;');
    }

    fs.writeFileSync(file, content);
  }
}
console.log('Fixed duplicate imports');
