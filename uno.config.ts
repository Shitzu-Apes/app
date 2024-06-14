import {
  defineConfig,
  presetUno,
  presetAttributify,
  presetTypography,
  presetIcons,
} from "unocss";
import { presetFluid } from "unocss-preset-fluid";

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify(),
    presetTypography(),
    presetIcons(),
    presetFluid({
      minWidth: 200,
      maxWidth: 448,
    }),
  ],
});
