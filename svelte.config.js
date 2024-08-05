import { preprocessMeltUI, sequence } from "@melt-ui/pp";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { sveltePreprocess } from "svelte-preprocess";
import adapter from "sveltekit-adapter-deno";

/** @type {import('@sveltejs/kit').Config}*/
const config = {
  // Consult https://kit.svelte.dev/docs/integrations#preprocessors
  // for more information about preprocessors
  preprocess: sequence([
    vitePreprocess(),
    preprocessMeltUI(),
    sveltePreprocess({
      scss: {
        prependData: `@use "src/mixins.scss" as *;`,
      },
    }),
  ]),
  kit: {
    adapter: adapter(),
  },
};
export default config;
