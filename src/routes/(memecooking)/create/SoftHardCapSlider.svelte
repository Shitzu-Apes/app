<script lang="ts">
  import { createSlider, melt } from "@melt-ui/svelte";

  // Define NEAR amounts in YoctoNEAR (1 NEAR = 10^24 YoctoNEAR)
  export let softCap: string = "1000000000000000000000000"; // 1 NEAR
  export let hardCap: string | null = null; // e.g., "5000000000000000000000000" for 5 NEAR
  export let hardCapEnabled: boolean;

  const NEAR_DECIMALS = 24;
  const NEAR_MULTIPLIER = BigInt(10) ** BigInt(NEAR_DECIMALS);

  // Convert string amounts to numbers for slider (assuming slider max of 4000 NEAR)
  const softCapNumber: number = Number(softCap) / Number(NEAR_MULTIPLIER);
  const hardCapNumber: number | null = hardCap
    ? Number(hardCap) / Number(NEAR_MULTIPLIER)
    : null;

  // Create a slider with one or two handles based on hardCapEnabled
  let {
    elements: { root, range, thumbs },
    states: { value: sliderValues },
  } = createSlider({
    defaultValue: hardCapEnabled
      ? [softCapNumber, hardCapNumber || 4000]
      : [softCapNumber],
    min: 100,
    max: 4000, // Representing up to 4000 NEAR
    step: 0.1, // 0.1 NEAR steps
    autoSort: true,
  });

  $: {
    const slider = createSlider({
      defaultValue: hardCapEnabled
        ? [softCapNumber, hardCapNumber || 4000]
        : [softCapNumber],
      min: 100,
      max: 4000, // Representing up to 4000 NEAR
      step: 5,
      autoSort: true,
    });

    root = slider.elements.root;
    range = slider.elements.range;
    thumbs = slider.elements.thumbs;
    sliderValues = slider.states.value;
  }

  $: if (hardCapEnabled) {
    const [soft, hard] = $sliderValues;
    softCap = (
      (BigInt(Math.round(soft * 10 ** 1)) * NEAR_MULTIPLIER) /
      BigInt(10 ** 1)
    ).toString();
    hardCap = (
      (BigInt(Math.round((hard || 4000) * 10 ** 1)) * NEAR_MULTIPLIER) /
      BigInt(10 ** 1)
    ).toString();
  } else {
    const [soft] = $sliderValues;
    softCap = (
      (BigInt(Math.round(soft * 10 ** 1)) * NEAR_MULTIPLIER) /
      BigInt(10 ** 1)
    ).toString();
    hardCap = null;
  }
</script>

<div class="space-y-4 flex flex-col items-center w-full">
  <!-- Soft cap is the min near to be deposited at the end of duration to launch the ref -->
  <!-- Hard cap is the number that is once reached, it will immediately launch on ref -->
  <span use:melt={$root} class="relative flex h-[20px] w-full items-center">
    <span class="h-[3px] w-full bg-shitzu-4">
      <span use:melt={$range} class="h-[3px] bg-lime-4" />
    </span>

    {#each $thumbs.slice(0, hardCapEnabled ? 2 : 1) as thumb}
      <span
        use:melt={thumb}
        class="h-5 w-5 rounded-full bg-white focus:ring-4 focus:!ring-black/40"
      />
    {/each}
  </span>
  <div class="flex justify-between w-full text-sm">
    <span>
      Soft Cap: {(Number(softCap) / Number(NEAR_MULTIPLIER)).toFixed(2)} NEAR
    </span>
    {#if hardCapEnabled}
      <span>
        Hard Cap: {(Number(hardCap || 0) / Number(NEAR_MULTIPLIER)).toFixed(2)}
        NEAR
      </span>
    {/if}
  </div>
</div>
