const fs = require('fs');

function fixFile(file) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/npm run/g, 'pnpm run');
    content = content.replace(/npm test/g, 'pnpm test');
    content = content.replace(/npm install/g, 'pnpm install');
    content = content.replace(/npm rebuild/g, 'pnpm rebuild');
    content = content.replace(/npm ci/g, 'pnpm install --frozen-lockfile');
    content = content.replace(/cache: 'npm'/g, 'cache: "pnpm"');
    content = content.replace(/cache: "npm"/g, 'cache: "pnpm"');
    content = content.replace(/npm --version/g, 'pnpm --version');
    content = content.replace(/npm audit/g, 'pnpm audit');
    fs.writeFileSync(file, content);
}

const files = fs.readdirSync('.github/workflows').filter(f => f.endsWith('.yml')).map(f => '.github/workflows/' + f);
for (const f of files) {
    fixFile(f);
}
console.log('fixed');
