import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import svgr from "vite-plugin-svgr";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
const config = {
  plugins: [react(), tailwindcss(), svgr()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    allowedHosts: ["erp-warehouse.aetherglo.com"],
    port: 10011,
    strictPort: true,
    host: host || "0.0.0.0",
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 10011,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
    proxy: {
      "/trpc": {
        target: "http://localhost:10012",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://localhost:10012",
        changeOrigin: true,
      },
      "/notifications/stream": {
        target: "http://localhost:10012",
        changeOrigin: true,
        ws: true,
      },
      "/logs/stream": {
        target: "http://localhost:10012",
        changeOrigin: true,
      },
      "/api": {
        target: "http://localhost:10012",
        changeOrigin: true,
      },
    },
  },

  // Production preview server: forward same-origin calls to the backend
  preview: {
    host: "0.0.0.0",
    port: 10011,
    strictPort: true,
    proxy: {
      "/trpc": {
        target: "http://localhost:10012",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://localhost:10012",
        changeOrigin: true,
      },
      "/notifications/stream": {
        target: "http://localhost:10012",
        changeOrigin: true,
        ws: true,
      },
      "/logs/stream": {
        target: "http://localhost:10012",
        changeOrigin: true,
      },
      "/api": {
        target: "http://localhost:10012",
        changeOrigin: true,
      },
    },
  },
};

export default defineConfig(async ({ command }) => {
  // Vite derives `isProduction` from NODE_ENV, not from `mode`, so NODE_ENV has
  // to be right before Vite reads it. Nothing sets it for us: the repo-root
  // `bunfig.toml` has no `[run]` section (`[run] production` is not even a valid
  // Bun setting, so an earlier attempt to pin it there was a no-op), and a shell
  // that happens to export NODE_ENV=development would silently ship React's dev
  // JSX runtime plus every `import.meta.env.DEV` branch. Pin it for builds so
  // the bundle is a real production build (~250 kB smaller entry chunk) and
  // dev-only blocks — e.g. the route-error stack trace — are actually dropped.
  if (command === "build") process.env.NODE_ENV = "production";

  return config;
});
