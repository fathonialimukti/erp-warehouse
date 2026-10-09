module.exports = {
  apps: [
    {
      name: "erp-server",
      cwd: "/home/ubuntu/erp-warehouse/apps/server",
      script: "bun",
      args: "run dev",
      interpreter: "none",
      env: {
        NODE_ENV: "development",
        DEMO_LOGIN_ENABLED: "true",
      },
      kill_timeout: 10000,
      listen_timeout: 8000,
      shutdown_with_message: true,
    },
    {
      name: "erp-client",
      cwd: "/home/ubuntu/erp-warehouse/apps/client",
      script: "bun",
      args: "run dev",
      interpreter: "none",
      env: { NODE_ENV: "development" },
    },
  ],
};
