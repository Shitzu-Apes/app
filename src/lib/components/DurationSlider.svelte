<script lang="ts">
  import { createSlider, melt } from "@melt-ui/svelte";
  import dayjs from "dayjs";

  export let value: number = 1000 * 60 * 60 * 24; // Default duration is 24 hours

  const {
    elements: { root, range, thumbs },
    states: { value: sliderValue },
  } = createSlider({
    defaultValue: [value],
    min: 1000 * 60 * 5,
    step: 1000 * 60 * 5,
    max: 1000 * 60 * 60 * 24,
  });

  $: if ($sliderValue) {
    value = $sliderValue[0];
  }

  let humanDuration = "-";

  $: if (value) {
    if (value < 1000 * 60 * 60) {
      humanDuration = dayjs.duration(value, "ms").format("m [minutes]");
    } else if (value < 1000 * 60 * 60 * 2) {
      humanDuration = dayjs
        .duration(value, "ms")
        .format("H [hour] m [minutes]");
    } else if (value < 1000 * 60 * 60 * 24) {
      humanDuration = dayjs
        .duration(value, "ms")
        .format("H [hours] m [minutes]");
    } else {
      humanDuration = dayjs.duration(value, "ms").format("D [day]");
    }
  }
</script>

<div class="space-y-2 flex flex-col items-center">
  <div class="self-start block text-sm text-shitzu-4 font-600">duration</div>
  <span use:melt={$root} class="relative flex h-[20px] w-full items-center">
    <span class="h-[3px] w-full bg-black/40">
      <span use:melt={$range} class="h-[3px] bg-white" />
    </span>

    <span
      use:melt={$thumbs[0]}
      class="h-5 w-5 rounded-full bg-white focus:ring-4 focus:!ring-black/40"
    />
  </span>
  <span>{humanDuration}</span>
</div>
