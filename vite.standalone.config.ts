import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "node:path";

// Builds the entire app into ONE self-contained index.html (JS + CSS inlined)
// that runs from a plain file:// or any static host with no configuration.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
    outDir: "dist-standalone",
    rollupOptions: {
      input: path.resolve(__dirname, "index.standalone.html"),
    },
  },
});
