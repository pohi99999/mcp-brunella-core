module.exports = {
  apps: [
    {
      name: 'brunella-backend',
      script: 'build/index.js',
      cwd: 'F:/mcp-brunella-core',
      node_args: '--max-old-space-size=6144',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1500M',
      restart_delay: 3000,
      max_restarts: 10,
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      log_file: 'logs/pm2-backend.log',
      out_file: 'logs/pm2-backend-out.log',
      error_file: 'logs/pm2-backend-err.log',
      time: true,
    },
  ],
};
