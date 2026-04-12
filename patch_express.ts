import fs from 'fs';
import { globSync } from 'glob';

const files = globSync('src/**/*.ts');
for (const file of files) {
  if (file.includes('node_modules')) continue;
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Let's use `any` instead to be safe from express type mismatch issues
  if (content.includes("from 'express'")) {
      content = content.replace("import { Request, Response } from 'express';", "");
      content = content.replace("import type { Request, Response } from 'express';", "");
      content = content.replace("import { Request, Response, NextFunction } from 'express';", "");
      content = content.replace("import type { Request, Response, NextFunction } from 'express';", "");
      content = content.replace(/req: Request(<[^>]+>)?/g, "req: any");
      content = content.replace(/res: Response(<[^>]+>)?/g, "res: any");
      content = content.replace(/next: NextFunction/g, "next: any");
  }

  if (content !== original) {
      fs.writeFileSync(file, content);
      console.log(`Replaced in ${file}`);
  }
}
