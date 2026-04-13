import { defineConfig } from "vite";

export default defineConfig({
  base: "/lexXtract_general_law/",
  root: "web",
  publicDir: false,
  build: {
    outDir: "../docs",
    emptyOutDir: true,
  },
});
