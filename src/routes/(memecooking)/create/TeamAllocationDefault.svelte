<script lang="ts" context="module">
  const isTestnet = import.meta.env.VITE_NETWORK_ID === "testnet";

  export const ALLOCATION_DEFAULT_OPTIONS: Record<
    "small" | "large",
    Omit<TeamAllocation, "vestingDurationMs" | "cliffDurationMs"> & {
      vestingDurationDays: number;
      cliffDurationDays: number;
      label: string;
    }
  > = {
    small: {
      allocationBps: 500,
      vestingDurationDays: 0,
      cliffDurationDays: 0,
      label: "Instant Allocation",
    },
    large: {
      label: "Vesting Allocation",
      allocationBps: 2000,
      vestingDurationDays: isTestnet ? 0.005 : 7,
      cliffDurationDays: isTestnet ? 0.001 : 2,
    },
  };
</script>

<script lang="ts">
  import { createSlider, melt } from "@melt-ui/svelte";

  import VestingChart from "$lib/components/VestingChart.svelte";
  import InputField from "$lib/components/memecooking/InputField.svelte";
  import type { TeamAllocation } from "$lib/models/memecooking";

  export let teamAllocation: TeamAllocation;

  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  let selectedOption: "small" | "large" | "customize" = "small";
  let vestingDurationDays = teamAllocation.vestingDurationMs / MS_PER_DAY;
  let cliffDurationDays = teamAllocation.cliffDurationMs / MS_PER_DAY;
  let allocationPercentage = teamAllocation.allocationBps / 100;

  // Create allocation slider
  let {
    elements: { root, range, thumbs },
    states: { value: sliderValue },
  } = createSlider({
    defaultValue: [allocationPercentage],
    min: 0.1,
    max: 90,
    step: 0.1,
  });

  $: allocationPercentage = $sliderValue[0];
  $: teamAllocation.vestingDurationMs = vestingDurationDays * MS_PER_DAY;
  $: teamAllocation.cliffDurationMs = cliffDurationDays * MS_PER_DAY;
  $: teamAllocation.allocationBps = allocationPercentage * 100;

  $: hasError =
    teamAllocation.allocationBps < 0 || teamAllocation.allocationBps > 9000;

  function selectOption(option: string) {
    selectedOption = option as "small" | "large" | "customize";
    if (option !== "customize") {
      const selected = ALLOCATION_DEFAULT_OPTIONS[option as "small" | "large"];
      vestingDurationDays = selected.vestingDurationDays;
      cliffDurationDays = selected.cliffDurationDays;
      $sliderValue = [selected.allocationBps / 100];
    }
  }
</script>

<div class="space-y-4 flex flex-col items-center w-full">
  <div class="flex space-x-4 mb-4 w-full">
    {#each Object.entries(ALLOCATION_DEFAULT_OPTIONS) as [key, option]}
      <div class="flex-grow basis-0">
        <button
          on:click={() => selectOption(key)}
          class={`aspect-square w-full p-2 border rounded ${selectedOption === key ? "bg-shitzu-4" : "bg-gray-700"} text-white text-sm flex flex-col items-center justify-center`}
        >
          <div class="font-semibold">{option.label}</div>
          <div class="flex items-center">
            {option.allocationBps / 100}% Allocation
          </div>
          {#if key === "small"}
            <div class="flex items-center">Instant</div>
          {:else}
            <div class="flex items-center">
              {option.cliffDurationDays}d Cliff
            </div>
            <div class="flex items-center">
              {option.vestingDurationDays}d Vesting
            </div>
          {/if}
        </button>
      </div>
    {/each}

    <div class="flex-grow basis-0">
      <button
        on:click={() => selectOption("customize")}
        class={`aspect-square w-full p-2 border rounded ${selectedOption === "customize" ? "bg-shitzu-4" : "bg-gray-700"} text-white text-sm`}
      >
        <div class="font-semibold">Customize</div>
      </button>
    </div>
  </div>

  <!-- Chart Visualization -->
  {#if teamAllocation.allocationBps > 0 && !hasError}
    <VestingChart {teamAllocation} />
  {/if}

  {#if selectedOption === "customize"}
    <div class="w-full space-y-4">
      <div class="space-y-2">
        <label
          for="allocation-slider"
          class="block text-sm text-shitzu-4 font-600"
        >
          Allocation (%)
        </label>
        <span
          use:melt={$root}
          class="relative flex h-[20px] w-full items-center"
        >
          <span class="h-[3px] w-full bg-shitzu-4">
            <span use:melt={$range} class="h-[3px] bg-lime-4" />
          </span>
          {#each $thumbs as thumb}
            <span
              use:melt={thumb}
              class="h-5 w-5 rounded-full bg-white focus:ring-4 focus:!ring-black/40"
            />
          {/each}
        </span>
        <div class="flex justify-between text-sm text-gray-400">
          <span>0%</span>
          <span>{allocationPercentage.toFixed(1)}%</span>
          <span>90%</span>
        </div>
      </div>

      <div class="space-y-4 pt-2">
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <InputField
              label="Cliff Duration"
              type="number"
              min={0}
              step={1}
              bind:value={cliffDurationDays}
              tooltip="Days before tokens start unlocking"
            />
          </div>

          <div class="flex flex-col gap-1">
            <InputField
              label="Vesting Duration"
              type="number"
              min={0}
              step={1}
              bind:value={vestingDurationDays}
              tooltip="Days over which tokens gradually unlock after cliff period"
            />
          </div>
        </div>
      </div>
    </div>
  {/if}

  <div class="text-sm text-gray-400 w-full bg-gray-800/50 p-4 rounded-lg">
    <span class="font-semibold text-shitzu-4">Summary:</span> The team will
    receive {allocationPercentage}% of the total supply.
    {#if vestingDurationDays === 0 && cliffDurationDays === 0}
      This amount will be available instantly after launch.
    {:else}
      The tokens will be locked for {cliffDurationDays} days (cliff period), after
      which they will gradually unlock over {vestingDurationDays} days.
    {/if}
  </div>
</div>
