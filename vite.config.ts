import { sveltekit } from "@sveltejs/kit/vite";
import extractorSvelte from "@unocss/extractor-svelte";
import { SvelteKitPWA } from "@vite-pwa/sveltekit";
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
    SvelteKitPWA({
      strategies: "generateSW",
      injectRegister: "inline",
      registerType: "autoUpdate",
      includeAssets: ["assets/favicon.ico", "assets/apple-touch-icon.png"],
      manifest: {
        name: "Shitzu App",
        short_name: "Shitzu",
        description: "Shitzu App - Your gateway to the Shitzu ecosystem",
        theme_color: "#222222",
        icons: [
          {
            src: "assets/pwa-64x64.png",
            sizes: "64x64",
            type: "image/png",
          },
          {
            src: "assets/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "assets/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "assets/maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        background_color: "#222222",
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MiB
      },
      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve("src"),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: '@use "src/mixins.scss" as *;',
      },
    },
  },
  // build: {
  //   rollupOptions: {
  //     external: [
  //       "@jsquash/png",
  //       "@jsquash/jpeg",
  //       "@jsquash/webp",
  //       "@jsquash/jxl",
  //       "@jsquash/avif",
  //       "@jsquash/resize",
  //     ],
  //   },
  // },
  optimizeDeps: {
    exclude: [
      "@jsquash/png",
      "@jsquash/jpeg",
      "@jsquash/webp",
      "@jsquash/jxl",
      "@jsquash/avif",
      "@jsquash/resize",
    ],
  },
  worker: {
    format: "es",
  },
});
