const fs = require('fs');

function fixFile(file) {
    let content = fs.readFileSync(file, 'utf8');

    // For workflows that use "uses: actions/setup-node@v4" but we missed "Setup Node.js" because it didn't have "name:"
    if (!content.includes('uses: pnpm/action-setup')) {
        content = content.replace(
            /- uses: actions\/setup-node@v4/g,
            '- name: Setup pnpm\n        uses: pnpm/action-setup@v3\n        with:\n          version: 10.30.3\n\n      - uses: actions/setup-node@v4'
        );
    }

    fs.writeFileSync(file, content);
}

const files = fs.readdirSync('.github/workflows').filter(f => f.endsWith('.yml')).map(f => '.github/workflows/' + f);
for (const f of files) {
    fixFile(f);
}
console.log('fixed');
