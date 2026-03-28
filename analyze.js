const r = JSON.parse(require('fs').readFileSync('.eslint-report-src.json', 'utf8'));
const byDir = {};
for (let i = 0; i < r.length; i++) {
  const warns = r[i].messages.filter(m => m.severity === 1 && m.ruleId === 'no-console');
  if (warns.length > 0) {
    const p = r[i].filePath;
    const parts = p.split(/src./).slice(1);
    const sub = parts.length > 0 ? parts[0].split(/[\\/]/)[0] : 'root';
    byDir[sub] = (byDir[sub] || 0) + warns.length;
  }
}
console.log(JSON.stringify(byDir, null, 2));
