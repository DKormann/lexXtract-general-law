import { defineConfig } from "vite";

export default defineConfig({
  base: "/lexXtract-general-law/",
  root: "web",
  publicDir: false,
  build: {
    outDir: "../docs",
    emptyOutDir: true,
  },
});
