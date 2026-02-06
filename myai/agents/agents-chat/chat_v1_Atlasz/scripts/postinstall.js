const { spawnSync } = require('child_process');
const path = require('path');

// Skip agent setup on Vercel/CI or when explicitly disabled.
if (process.env.VERCEL === '1' || process.env.SKIP_AGENT_INSTALL === '1') {
  console.log('Skipping agent setup (cloud build).');
  process.exit(0);
}

const isWindows = process.platform === 'win32';
const scriptPath = isWindows
  ? path.join(__dirname, 'setup-agent.bat')
  : path.join(__dirname, 'setup-agent.sh');

const result = spawnSync(scriptPath, { stdio: 'inherit', shell: true });
if (result.status !== 0) {
  console.error('Agent setup failed. Set SKIP_AGENT_INSTALL=1 to bypass.');
  process.exit(result.status ?? 1);
}
