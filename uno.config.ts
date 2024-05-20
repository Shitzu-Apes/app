import {
  defineConfig,
  presetUno,
  presetAttributify,
  presetTypography,
  presetIcons,
} from "unocss";

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify(),
    presetTypography(),
    presetIcons(),
  ],
});
