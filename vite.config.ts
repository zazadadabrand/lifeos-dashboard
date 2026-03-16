import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  base: "./",
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    proxy: {
      "/api/pipeline/snapshot": {
        target: "https://jsonblob.com",
        changeOrigin: true,
        rewrite: () => "/api/jsonBlob/019cf4cc-d5b8-705a-97d6-502d72422549",
      },
      "/api/pipeline/changes": {
        target: "https://jsonblob.com",
        changeOrigin: true,
        rewrite: () => "/api/jsonBlob/019cf4b1-c056-7145-8ce7-165cc8918236",
      },
    },
  },
});
