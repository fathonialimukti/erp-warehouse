module.exports = {
  apps: [
    {
      name: "erp-server",
      cwd: "/workspaces/erp-warehouse/apps/server",
      script: "bun",
      args: "run dev",
      interpreter: "none",
      env: {
        NODE_ENV: "development",
        DEMO_LOGIN_ENABLED: process.env.DEMO_LOGIN_ENABLED,
      },
      kill_timeout: 10000,
      listen_timeout: 8000,
      shutdown_with_message: true,
    },
    {
      name: "erp-client",
      cwd: "/workspaces/erp-warehouse/apps/client",
      script: "bun",
      args: "run dev",
      interpreter: "none",
      env: { NODE_ENV: "development" },
    },
    {
      name: "opencode",
      cwd: "/workspaces/erp-warehouse",
      process_env_file: false,
      script: "/usr/local/bin/opencode",
      args: "serve --hostname 0.0.0.0 --port 10013",
      interpreter: "none",
      env: {
        NODE_ENV: 'development',
        // Credentials must come from the environment — never hardcode secrets here.
        // Set OPENCODE_SERVER_USERNAME / OPENCODE_SERVER_PASSWORD before starting.
        OPENCODE_SERVER_USERNAME: process.env.OPENCODE_SERVER_USERNAME,
        OPENCODE_SERVER_PASSWORD: process.env.OPENCODE_SERVER_PASSWORD,
      },
    },
  ],
};
