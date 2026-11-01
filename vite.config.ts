import { defineConfig } from "vite";

// The frontend lives in src/; ingest output in public/generated/ is served as static files.
export default defineConfig({
  root: "src",
  publicDir: "../public",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});
