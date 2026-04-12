import fs from 'fs';

const path = 'src/server/schedulers/testRunner.ts';
let content = fs.readFileSync(path, 'utf8');

// The issue is `cron.ScheduledTask` should be imported as a type or `cron` shouldn't be used as a namespace since it's default imported.
content = content.replace("let schedulerTask: cron.ScheduledTask | null = null;", "let schedulerTask: any = null;");

fs.writeFileSync(path, content);
console.log('Fixed testRunner.ts');
