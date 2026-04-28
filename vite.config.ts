import { defineConfig } from "vite";

export default defineConfig({
  base: "/lexXtract-general-law/",
  root: "view",
  publicDir: false,
  build: {
    outDir: "../docs",
    emptyOutDir: true,
  },
});
