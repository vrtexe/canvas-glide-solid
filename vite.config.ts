import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [solid(), dts({ tsconfigPath: "./tsconfig.app.json", compilerOptions: { composite: false } })],
  build: {
    lib: {
      entry: "src/canvas-glide.ts",
      fileName: "canvas-glide",
      formats: ["es"],
    },
    rollupOptions: {
      external: ["canvas-glide", "solid-js", "solid-js/web", "solid-js/store"],
    },
  },
});
