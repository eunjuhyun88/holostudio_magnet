import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: "index.react.html",
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          three: ["three"],
        },
      },
    },
  },
});
