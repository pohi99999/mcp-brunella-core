import fs from 'node:fs';
import path from 'node:path';

const packageNamespaces = [
  { namespace: '@packages', root: path.join('build', 'packages'), entries: ['agents', 'core-logic', 'database', 'myai', 'types', 'utils'] },
  { namespace: '@apps', root: path.join('build', 'apps'), entries: ['mcp-core', 'dashboard', 'cloudflare-edge'] },
];

function collectJsFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectJsFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

for (const { namespace, root, entries } of packageNamespaces) {
  const aliasRoot = path.join('build', 'node_modules', namespace);

  for (const entry of entries) {
    const sourceRoot = path.join(root, entry);
    const targetRoot = path.join(aliasRoot, entry);
    fs.mkdirSync(targetRoot, { recursive: true });
    fs.writeFileSync(
      path.join(targetRoot, 'package.json'),
      JSON.stringify(
        {
          name: `${namespace}/${entry}`,
          type: 'module',
          exports: {
            '.': './index.js',
            './*': './*',
          },
        },
        null,
        2,
      ),
    );

    for (const sourceFile of collectJsFiles(sourceRoot)) {
      const relative = path.relative(sourceRoot, sourceFile).replace(/\\/g, '/');
      const aliasFile = path.join(targetRoot, relative);
      fs.mkdirSync(path.dirname(aliasFile), { recursive: true });
      const sourceAbs = path.resolve(sourceFile);
      const aliasDirAbs = path.resolve(path.dirname(aliasFile));
      const importTarget = path.relative(aliasDirAbs, sourceAbs).replace(/\\/g, '/');
      fs.writeFileSync(aliasFile, `export * from '${importTarget}';\n`);
    }
  }
}
