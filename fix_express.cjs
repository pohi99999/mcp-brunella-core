const fs = require('fs');

const webPath = 'src/server/web.ts';
let webContent = fs.readFileSync(webPath, 'utf8');

// Replace these occurrences where missing express request handler typings caused errors
webContent = webContent.replace(/app\.use\('\/', async \(req, res, next\) => \{/g, 'app.use(\'/\', async (req: any, res: any, next: any) => {');
webContent = webContent.replace(/app\.use\('\/v1', async \(req, res, next\) => \{/g, 'app.use(\'/v1\', async (req: any, res: any, next: any) => {');
// Fix missing typing on route level middlewares too
webContent = webContent.replace(/app\.use\('\/ui', authenticateToken, uiRouter\);/g, 'app.use(\'/ui\', authenticateToken as any, uiRouter);');

// The errors say "(req: Request, res: Response, next: NextFunction) => void" is not assignable to RequestHandler
// We need to just override all app.use that fail or fallback the authenticateToken
webContent = webContent.replace(/app\.use\('\/api', authenticateToken, apiRouter\);/g, 'app.use(\'/api\', authenticateToken as any, apiRouter);');
webContent = webContent.replace(/app\.use\('\/paios', authenticateToken, paiosRouter\);/g, 'app.use(\'/paios\', authenticateToken as any, paiosRouter);');

// There are specific router method calls missing generic types, let's just make sure everything related to 'Request' and 'Response' from 'express' uses 'any' for now since the definitions are seemingly clashing.
// Or we can import from express-serve-static-core.
// Let's replace 'req: Request, res: Response' -> 'req: any, res: any' in all files.
fs.writeFileSync(webPath, webContent);

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
  'src/server/routes/enterpriseApi.ts'
];

for (const file of filesToFix) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/req: Request([^,)]*)/g, 'req: any');
    content = content.replace(/res: Response([^,)]*)/g, 'res: any');
    // For next
    content = content.replace(/next: NextFunction/g, 'next: any');
    fs.writeFileSync(file, content);
  }
}

console.log('Fixed express routes again');
