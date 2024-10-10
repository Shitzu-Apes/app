<script lang="ts">
  import { createSlider, melt } from "@melt-ui/svelte";

  export let value: number = 1000 * 60 * 60; // Default duration is 1 hour
  const defaultValue = [value];

  let {
    elements: { root, range, thumbs },
    states: { value: sliderValue },
  } = createSlider({
    defaultValue: [value],
    min: 1000 * 60 * 5, // Minimum duration: 5 minutes
    max: 1000 * 60 * 60 * 24, // Maximum duration: 24 hours
    step: 1000 * 60 * 5, // Step: 5 minutes
  });

  // Update the value when the slider changes
  $: {
    const slider = createSlider({
      defaultValue: defaultValue,
      min: 1000 * 60 * 5, // Minimum duration: 5 minutes
      max: 1000 * 60 * 60 * 24, // Maximum duration: 24 hours
      step: 1000 * 60 * 5, // Step: 5 minutes
    });

    root = slider.elements.root;
    range = slider.elements.range;
    thumbs = slider.elements.thumbs;
    sliderValue = slider.states.value;
  }

  $: {
    value = $sliderValue[0];
  }
</script>

<div use:melt={$root} class="relative flex h-[20px] w-full items-center">
  <span class="h-[3px] w-full bg-white/40">
    <span use:melt={$range} class="h-[3px] bg-shitzu-4" />
  </span>

  <span
    use:melt={$thumbs[0]}
    class="h-5 w-5 rounded-full bg-white focus:ring-4 focus:!ring-black/40"
  />
</div>
