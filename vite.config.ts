import { sveltekit } from "@sveltejs/kit/vite";
import path from "node:path";
import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

import UnoCSS from "unocss/vite";
import extractorSvelte from "@unocss/extractor-svelte";

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
