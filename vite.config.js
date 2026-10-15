import { defineConfig } from "vite";
export default defineConfig({
  esbuild: { jsx: "automatic" },
  server: { proxy: { "/api": "http://127.0.0.1:3000" } },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          router: ["react-router-dom"],
          query: ["@tanstack/react-query"],
        },
      },
    },
  },
});
