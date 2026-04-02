const path = require('path');

const nodeHeapMb = Number(process.env.BRUNELLA_NODE_MAX_OLD_SPACE_SIZE || 1536);
const runtimeMemoryLimitMb = Number(
  process.env.BRUNELLA_RUNTIME_MEMORY_LIMIT_MB || Math.max(2048, nodeHeapMb + 512),
);
const restartThresholdMb = Number(
  process.env.BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB ||
    Math.min(runtimeMemoryLimitMb - 128, nodeHeapMb + 256),
);

module.exports = {
  apps: [
    {
      name: 'brunella-backend',
      script: 'scripts/start-stable.mjs',
      cwd: path.resolve(__dirname),
      node_args: `--max-old-space-size=${nodeHeapMb}`,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: `${restartThresholdMb}M`,
      restart_delay: 3000,
      max_restarts: 10,
      kill_timeout: 30000,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        WEB_UI_ENABLED: 'true',
        BRUNELLA_NODE_MAX_OLD_SPACE_SIZE: String(nodeHeapMb),
        BRUNELLA_RUNTIME_MEMORY_LIMIT_MB: String(runtimeMemoryLimitMb),
        BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB: String(restartThresholdMb),
      },
      log_file: 'logs/pm2-backend.log',
      out_file: 'logs/pm2-backend-out.log',
      error_file: 'logs/pm2-backend-err.log',
      time: true,
    },
  ],
};
