<script lang="ts">
  import dayjs from "dayjs";

  import DurationSliderComponent from "./DurationSliderComponent.svelte";

  export let value: number = 1000 * 60 * 60; // Default duration is 1 hour
  let selectedOption: "5m" | "1h" | "24h" | "customize" = "1h";

  // Function to format duration for display
  function formatHumanDuration(value: number): string {
    if (value < 1000 * 60 * 60) {
      return dayjs.duration(value, "ms").format("m[m]");
    } else if (value < 1000 * 60 * 60 * 24) {
      return dayjs.duration(value, "ms").format("H[h] m[m]");
    } else {
      return dayjs.duration(value, "ms").format("D[d]");
    }
  }

  // Reactive statement to update human-readable duration
  $: humanDuration = formatHumanDuration(value);

  function selectOption(option: "5m" | "1h" | "24h" | "customize") {
    selectedOption = option;
    if (option === "5m") {
      value = 1000 * 60 * 5;
    } else if (option === "1h") {
      value = 1000 * 60 * 60;
    } else if (option === "24h") {
      value = 1000 * 60 * 60 * 24;
    }
    // For "customize", the value will be set by the slider component
  }
</script>

<div class="space-y-4 flex flex-col items-center">
  <div class="self-start block text-sm text-shitzu-4 font-600">Duration</div>
  <div class="flex space-x-2 mb-2 w-full">
    <button
      class={`px-4 py-2 rounded flex-1 basis-0 ${
        selectedOption === "5m"
          ? "bg-shitzu-4 text-white"
          : "bg-gray-800 text-white"
      } focus:outline-none border border-white`}
      on:click={() => selectOption("5m")}
    >
      5m
    </button>
    <button
      class={`px-4 py-2 rounded flex-1 basis-0 ${
        selectedOption === "1h"
          ? "bg-shitzu-4 text-white"
          : "bg-gray-800 text-white"
      } focus:outline-none border border-white`}
      on:click={() => selectOption("1h")}
    >
      1h
    </button>
    <button
      class={`px-4 py-2 rounded flex-1 basis-0 ${
        selectedOption === "24h"
          ? "bg-shitzu-4 text-white"
          : "bg-gray-800 text-white"
      } focus:outline-none border border-white`}
      on:click={() => selectOption("24h")}
    >
      24h
    </button>
    <button
      class={`px-4 py-2 rounded flex-[2_1_0%] basis-0 ${
        selectedOption === "customize"
          ? "bg-shitzu-4 text-white"
          : "bg-gray-800 text-white"
      } focus:outline-none border border-white`}
      on:click={() => selectOption("customize")}
    >
      {selectedOption !== "customize" ? "Customize" : humanDuration}
    </button>
  </div>

  {#if selectedOption === "customize"}
    <!-- Include the slider component for customization -->
    <DurationSliderComponent bind:value />
  {/if}
</div>
