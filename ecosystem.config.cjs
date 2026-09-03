/**
 * PM2 ecosystem configuration for Bun-based ERP warehouse monorepo.
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs        # start all apps
 *   pm2 start ecosystem.config.cjs --only erp-server   # start server only
 *   pm2 start ecosystem.config.cjs --only erp-client   # start client only
 *   pm2 stop all | pm2 restart all | pm2 delete all
 *   pm2 logs | pm2 monit | pm2 status
 */
module.exports = {
  apps: [
    {
      name: "erp-server",
      cwd: "./apps/server",
      interpreter: "bun",
      script: "dist/index.js",
      // Bun resolves node_modules from cwd; no need for NODE_ENV in most cases
      env: {
        NODE_ENV: "production",
      },
      // Restart policy
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      max_memory_restart: "1G",
      // Logging
      log_file: "./logs/server-combined.log",
      out_file: "./logs/server-out.log",
      error_file: "./logs/server-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      // Advanced
      kill_timeout: 5000,
      listen_timeout: 8000,
      wait_ready: false,
      // Production hardening
      instances: 1,           // Single-tenant VPS — one instance is enough
      exec_mode: "fork",      // SSE in-memory state requires fork mode
      // Graceful shutdown
      shutdown_with_message: true,  // Sends SIGTERM instead of SIGKILL
    },
    {
      name: "erp-client",
      cwd: "./apps/client",
      interpreter: "bun",
      script: "node_modules/vite/bin/vite.js",
      args: "preview --host 0.0.0.0 --port 10011",
      env: {
        NODE_ENV: "production",
      },
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      max_memory_restart: "512M",
      log_file: "./logs/client-combined.log",
      out_file: "./logs/client-out.log",
      error_file: "./logs/client-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      kill_timeout: 5000,
      listen_timeout: 8000,
      wait_ready: false,
      shutdown_with_message: true,
    },
  ],
};
