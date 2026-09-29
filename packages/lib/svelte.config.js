import { preprocessMeltUI, sequence } from "@melt-ui/pp";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { sveltePreprocess } from "svelte-preprocess";

const config = {
  preprocess: sequence([
    vitePreprocess(),
    preprocessMeltUI(),
    sveltePreprocess({
      scss: {
        prependData: `@use "src/mixins.scss" as *;`,
      },
    }),
  ]),
};

export default config;
