const fs = require('fs');

const file = 'src/server/routes/webhooks.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/\/\/ @ts-expect-error/g, '');
fs.writeFileSync(file, content);

console.log("Fixed unused ts expects");
