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
  theme: {
    colors: {
      shitzu: {
        "50": "#ecfdf5",
        "100": "#d2f9e5",
        "200": "#a9f1d0",
        "300": "#72e3b6",
        "400": "#31c891",
        "500": "#15b47f",
        "600": "#099267",
        "700": "#077556",
        "800": "#095c45",
        "900": "#084c3a",
        "950": "#032b21",
        "1": "#d2f9e5",
        "2": "#a9f1d0",
        "3": "#72e3b6",
        "4": "#31c891",
        "5": "#15b47f",
        "6": "#099267",
        "7": "#077556",
        "8": "#095c45",
        "9": "#084c3a",
      },
    },
  },
  shortcuts: {
    loader: "animate-pulse bg-shitzu-9 rounded",
    "loader-round": "animate-pulse bg-shitzu-9 rounded-full",
  },
});
