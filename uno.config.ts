import {
  defineConfig,
  presetUno,
  presetAttributify,
  presetTypography,
  presetIcons,
} from "unocss";
import { presetExtra } from "unocss-preset-extra";
import { presetFluid } from "unocss-preset-fluid";
import { presetScrollbar } from "unocss-preset-scrollbar";

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
    presetScrollbar(),
    presetExtra(),
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
      memecooking: {
        "50": "#fcffe7",
        "100": "#f6ffc1",
        "200": "#f1ff86",
        "300": "#f1ff41",
        "400": "#f9ff0d",
        "500": "#f6ef00",
        "600": "#d1b900",
        "700": "#a68602",
        "800": "#89680a",
        "900": "#74550f",
        "950": "#442e04",
        "1": "#f6ffc1",
        "2": "#f1ff86",
        "3": "#f1ff41",
        "4": "#f9ff0d",
        "5": "#f6ef00",
        "6": "#d1b900",
        "7": "#a68602",
        "8": "#89680a",
        "9": "#74550f",
      },
    },
  },
  shortcuts: {
    loader: "animate-pulse bg-shitzu-9 rounded",
    "loader-round": "animate-pulse bg-shitzu-9 rounded-full",
  },
});
