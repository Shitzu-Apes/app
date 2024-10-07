<script lang="ts">
  import SoftHardCapSlider from "./SoftHardCapSlider.svelte";

  import Near from "$lib/assets/Near.svelte";

  const NEAR_DECIMALS = 24;
  const NEAR_MULTIPLIER = BigInt(10) ** BigInt(NEAR_DECIMALS);

  const presetOptions = {
    small: {
      softCap: "100000000000000000000000000", // 100 NEAR in YoctoNEAR
      hardCap: "500000000000000000000000000", // 500 NEAR in YoctoNEAR
    },
    large: {
      softCap: "500000000000000000000000000", // 500 NEAR in YoctoNEAR
      hardCap: "1000000000000000000000000000", // 1000 NEAR in YoctoNEAR
    },
  };

  export let softCap: string = presetOptions.small.softCap;
  export let hardCap: string | null = presetOptions.small.hardCap;
  export let hardCapEnabled: boolean = false;

  let selectedOption: "small" | "large" | "customize" = "small";

  function selectOption(option: "small" | "large" | "customize") {
    selectedOption = option;
    if (option === "small" || option === "large") {
      softCap = presetOptions[option].softCap;
      hardCap = presetOptions[option].hardCap;
      hardCapEnabled = true;
    } else if (option === "customize") {
      // Allow customization through the slider
    }
  }
</script>

<div class="flex space-x-4 mb-4">
  <div class="flex-grow basis-0">
    <button
      on:click={() => selectOption("small")}
      class={`aspect-square w-full p-2 border rounded ${selectedOption === "small" ? "bg-shitzu-4" : "bg-gray-700"} text-white text-sm flex flex-col items-center justify-center`}
    >
      <div class="font-semibold">Small Cap</div>
      <div class="flex items-center">
        Soft: 100 <Near className="size-4" />
      </div>
      <div class="flex items-center">
        Hard: 500 <Near className="size-4" />
      </div>
    </button>
  </div>
  <div class="flex-grow basis-0">
    <button
      on:click={() => selectOption("large")}
      class={`aspect-square w-full p-2 border rounded ${selectedOption === "large" ? "bg-shitzu-4" : "bg-gray-700"} text-white text-sm flex flex-col items-center justify-center`}
    >
      <div class="font-semibold">Large Cap</div>
      <div class="flex items-center">
        Soft: 500 <Near className="size-4" />
      </div>
      <div class="flex items-center">
        Hard: 1000 <Near className="size-4" />
      </div>
    </button>
  </div>
  <div class="flex-grow basis-0">
    <button
      on:click={() => selectOption("customize")}
      class={`aspect-square w-full p-2 border rounded ${selectedOption === "customize" ? "bg-shitzu-4" : "bg-gray-700"} text-white text-sm`}
    >
      <div class="font-semibold">Customize</div>
    </button>
  </div>
</div>

{#if selectedOption === "customize"}
  <SoftHardCapSlider bind:softCap bind:hardCap bind:hardCapEnabled />
{/if}

<div class="text-xs text-gray-400 w-full">
  The Soft Cap of {(Number(softCap) / Number(NEAR_MULTIPLIER)).toFixed(2)} NEAR is
  the minimum required to launch on ref once the duration is over. {#if hardCapEnabled}
    If the Hard Cap of {(
      Number(hardCap || 0) / Number(NEAR_MULTIPLIER)
    ).toFixed(2)} NEAR is reached, it will trigger an immediate launch.{/if}
</div>
