const fs = require('fs');

function patchFile(file) {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');

    // Add pnpm setup before setup-node if it doesn't exist
    if (!content.includes('uses: pnpm/action-setup')) {
        content = content.replace(
            /- name: Setup Node\.js\s+uses: actions\/setup-node@v4/g,
            '- name: Setup pnpm\n        uses: pnpm/action-setup@v3\n        with:\n          version: 10.30.3\n\n      - name: Setup Node.js\n        uses: actions/setup-node@v4'
        );
        content = content.replace(
            /- name: Setup Node\s+uses: actions\/setup-node@v4/g,
            '- name: Setup pnpm\n        uses: pnpm/action-setup@v3\n        with:\n          version: 10.30.3\n\n      - name: Setup Node\n        uses: actions/setup-node@v4'
        );
    }

    // Replace npm commands
    content = content.replace(/npm install --no-frozen-lockfile/g, 'pnpm install --frozen-lockfile');
    content = content.replace(/npm ci/g, 'pnpm install --frozen-lockfile');
    content = content.replace(/npm run/g, 'pnpm run');
    content = content.replace(/cache: "npm"/g, 'cache: "pnpm"');

    fs.writeFileSync(file, content);
}

const files = fs.readdirSync('.github/workflows').filter(f => f.endsWith('.yml')).map(f => '.github/workflows/' + f);
for (const f of files) {
    patchFile(f);
}
console.log('patched');
