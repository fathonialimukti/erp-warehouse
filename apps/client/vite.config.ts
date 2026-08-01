import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from '@tailwindcss/vite'
import svgr from 'vite-plugin-svgr'

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
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
    host: host || '0.0.0.0',
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 10011,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
    proxy: {
      '/trpc': {
        target: 'http://0.0.0.0:10012',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://0.0.0.0:10012',
        changeOrigin: true,
      },
      '/notifications': {
        target: 'http://0.0.0.0:10012',
        changeOrigin: true,
        ws: true,
      },
      '/api': {
        target: 'http://0.0.0.0:10012',
        changeOrigin: true,
      },
    },
  },

  // Production preview server: forward same-origin calls to the backend
  preview: {
    host: '0.0.0.0',
    port: 10011,
    strictPort: true,
    proxy: {
      '/trpc': {
        target: 'http://0.0.0.0:10012',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://0.0.0.0:10012',
        changeOrigin: true,
      },
      '/notifications': {
        target: 'http://0.0.0.0:10012',
        changeOrigin: true,
        ws: true,
      },
      '/api': {
        target: 'http://0.0.0.0:10012',
        changeOrigin: true,
      },
    },
  },
}));
