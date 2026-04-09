const { execSync } = require('child_process');

try {
  execSync('git add .github/workflows/*.yml', { stdio: 'inherit' });
  execSync('git commit -m "ci: replace npm with pnpm across workflows to fix ERESOLVE and lockfile sync failures" -m "This fixes Check Suite failures on build-node, lint, and validate-and-test jobs which broke because npm ci and npm install was incorrectly used instead of pnpm install --frozen-lockfile, causing peer dependency collisions and GitHub Actions setup-node cache misses."', { stdio: 'inherit' });
  console.log("Committed.");
} catch(e) {
  console.error("Error committing:", e.message);
}
