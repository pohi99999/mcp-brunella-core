const path = require('path');

module.exports = {
  apps: [
    {
      name: 'brunella-backend',
      script: 'scripts/start-stable.mjs',
      cwd: path.resolve(__dirname),
      node_args: '--max-old-space-size=3072',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '3500M',
      restart_delay: 3000,
      max_restarts: 10,
      kill_timeout: 30000,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        WEB_UI_ENABLED: 'true',
      },
      log_file: 'logs/pm2-backend.log',
      out_file: 'logs/pm2-backend-out.log',
      error_file: 'logs/pm2-backend-err.log',
      time: true,
    },
  ],
};
