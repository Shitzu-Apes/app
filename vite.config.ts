import { sveltekit } from "@sveltejs/kit/vite";
import extractorSvelte from "@unocss/extractor-svelte";
import path from "node:path";
import UnoCSS from "unocss/vite";
import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    UnoCSS({
      extractors: [extractorSvelte()],
    }),
    sveltekit(),
    nodePolyfills(),
  ],
  resolve: {
    alias: {
      "@": path.resolve("src"),
    },
  },
});
