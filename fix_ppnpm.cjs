const fs = require('fs');

function fixFile(file) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/ppnpm/g, 'pnpm');
    fs.writeFileSync(file, content);
}

const files = fs.readdirSync('.github/workflows').filter(f => f.endsWith('.yml')).map(f => '.github/workflows/' + f);
for (const f of files) {
    fixFile(f);
}
console.log('fixed');
