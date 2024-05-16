import { sveltekit } from "@sveltejs/kit/vite";
import path from "node:path";
import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [sveltekit(), nodePolyfills()],
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: '@use "src/variables.scss" as *;',
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve("src"),
    },
  },
});
