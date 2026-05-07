import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import devServer from "@hono/vite-dev-server";

const __dirname = import.meta.dirname;

export default defineConfig({
  plugins: [
    devServer({ entry: "api/boot.ts", exclude: [/^\/(?!api\/).*$/] }),
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@contracts": path.resolve(__dirname, "./contracts"),
      "@db": path.resolve(__dirname, "./db"),
      db: path.resolve(__dirname, "./db"),
    },
  },
  envDir: path.resolve(__dirname),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, "/");
          if (normalizedId.includes("/node_modules/react/") || normalizedId.includes("/node_modules/react-dom/")) {
            return "react-vendor";
          }
          if (normalizedId.includes("/node_modules/lucide-react/")) {
            return "icons-vendor";
          }
          if (normalizedId.includes("/node_modules/")) {
            return "vendor";
          }
        },
      },
    },
  },
  server: {
    port: 3000,
    allowedHosts: true,
  },
});
