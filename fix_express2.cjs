const fs = require('fs');

const filesToFix = [
  'src/server/web.ts',
  'src/server/routes/system.ts',
  'src/server/routes/szamlazz.ts',
  'src/server/routes/testScheduler.ts',
  'src/server/routes/tools.ts',
  'src/server/routes/webhooks.ts',
  'src/server/routes/workers.ts',
  'src/server/routes/wrangler.ts',
  'src/server/routes/zeroPrompt.ts',
  'src/server/routes/enterpriseApi.ts',
  'src/server/routes/scaling.ts',
  'src/server/routes/scheduledTasks.ts',
  'src/server/routes/remote.ts',
  'src/server/routes/robotkez.ts'
];

for (const file of filesToFix) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');

    // Add import for Request and Response explicitly from express
    if (!content.includes("import { Request, Response } from 'express'")) {
        // Find the express import if it exists and inject Request, Response if they aren't there
        if(content.includes("import express")) {
            content = content.replace(/import express(?:.*?)(?=from 'express')/, "import express, { Request, Response, NextFunction } ");
        } else if (!content.includes("import { Request, Response")) {
            content = "import { Request, Response, NextFunction } from 'express';\n" + content;
        }
    }

    // Fix any "req: any, res: any" back to "req: Request, res: Response" for all these standard express middlewares
    // This is because we caused issues with overloaded handlers expecting express Types rather than 'any'
    content = content.replace(/\(req:\s*any,\s*res:\s*any\)/g, '(req: Request, res: Response)');
    content = content.replace(/\(req:\s*any,\s*res:\s*any,\s*next:\s*any\)/g, '(req: Request, res: Response, next: NextFunction)');

    // We also need to fix missing properties from standard express Request/Response when using custom generic wrappers.
    // e.g. Request<Params, ResBody, ReqBody, ReqQuery>
    // We can just use "req: Request<any, any, any, any>" and "res: Response<any>" to satisfy both generic type constraints AND express types
    content = content.replace(/req:\s*Request<[^>]+>/g, 'req: Request<any, any, any, any>');
    content = content.replace(/res:\s*Response<[^>]+>/g, 'res: Response<any>');

    // There is one tricky thing: we previously did a replace: `req: any`
    // Lets reset that for standalone `req: any` inside express routes
    content = content.replace(/\(req: any,\s*/g, '(req: Request, ');
    content = content.replace(/res: any\s*\)/g, 'res: Response)');

    // The `authenticateToken` export issue:
    content = content.replace(/export const authenticateToken = \(req: any, res: any, next: any\)/g, 'export const authenticateToken = (req: Request, res: Response, next: NextFunction)');

    fs.writeFileSync(file, content);
  }
}

// In enterpriseApi.ts, fix `authenticateEnterprise`
const eApiPath = 'src/server/routes/enterpriseApi.ts';
if (fs.existsSync(eApiPath)) {
  let eApiContent = fs.readFileSync(eApiPath, 'utf8');
  eApiContent = eApiContent.replace(/export const authenticateEnterprise = \(req: any, res: any, next: any\) => \{/g, 'export const authenticateEnterprise = (req: Request, res: Response, next: NextFunction) => {');
  fs.writeFileSync(eApiPath, eApiContent);
}

console.log('Fixed express routes with proper Request/Response types');
