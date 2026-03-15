import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      "@mesh/contracts": resolve(__dirname, "packages/contracts/src/index.ts"),
    },
  },
  server: {
    allowedHosts: [".ngrok-free.app"],
  },
  build: {
    chunkSizeWarningLimit: 550,
  },
});
