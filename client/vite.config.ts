import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server proxies API + SSE to the Fastify backend on :8787.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
        // SSE endpoints need streaming, not buffering.
        configure: () => {},
      },
    },
  },
});
