const fs = require('fs');
const path = require('path');

const outDir = path.join(process.cwd(), 'test_build');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Ensure Node treats test_build/*.js as CommonJS
const pkgPath = path.join(outDir, 'package.json');
fs.writeFileSync(pkgPath, JSON.stringify({ type: "commonjs" }, null, 2));

console.log('test_build/package.json created with type=commonjs');
