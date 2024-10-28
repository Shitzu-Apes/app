<script lang="ts">
  import VestingChart from "$lib/components/VestingChart.svelte";
  import InputField from "$lib/components/memecooking/InputField.svelte";
  import type { TeamAllocation } from "$lib/models/memecooking";

  export let teamAllocation: TeamAllocation;

  const MS_PER_DAY = 24 * 60 * 60 * 1000;

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
      vestingDurationDays: 6,
      cliffDurationDays: 2,
      label: "Small Allocation",
    },
    large: {
      label: "Large Allocation",
      allocationBps: 2000,
      vestingDurationDays: 7,
      cliffDurationDays: 3,
    },
  };

  let selectedOption: "small" | "large" | "customize" = "small";
  let vestingDurationDays = teamAllocation.vestingDurationMs / MS_PER_DAY;
  let cliffDurationDays = teamAllocation.cliffDurationMs / MS_PER_DAY;

  $: teamAllocation.vestingDurationMs = vestingDurationDays * MS_PER_DAY;
  $: teamAllocation.cliffDurationMs = cliffDurationDays * MS_PER_DAY;

  function selectOption(option: string) {
    selectedOption = option as "small" | "large" | "customize";
    if (option !== "customize") {
      const selected = ALLOCATION_DEFAULT_OPTIONS[option as "small" | "large"];
      teamAllocation.allocationBps = selected.allocationBps;
      vestingDurationDays = selected.vestingDurationDays;
      cliffDurationDays = selected.cliffDurationDays;
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
          <div class="flex items-center">
            {option.cliffDurationDays}d Cliff
          </div>
          <div class="flex items-center">
            {option.vestingDurationDays}d Vesting
          </div>
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
  {#if teamAllocation.allocationBps > 0}
    <VestingChart {teamAllocation} />
  {/if}

  {#if selectedOption === "customize"}
    <div class="w-full space-y-4">
      <InputField
        label="Allocation (bps)"
        type="number"
        min={0}
        max={10000}
        step={1}
        bind:value={teamAllocation.allocationBps}
        validate={(value) => {
          if (typeof value !== "number" || value < 0 || value > 10000) {
            return "Allocation Bps must be between 0 and 10000";
          }
          return "";
        }}
      />

      <InputField
        label="Vesting Duration (days)"
        type="number"
        min={0}
        step={1}
        bind:value={vestingDurationDays}
      />

      <InputField
        label="Cliff Duration (days)"
        type="number"
        min={0}
        step={1}
        bind:value={cliffDurationDays}
      />
    </div>
  {/if}

  <div class="text-xs text-gray-400 w-full">
    The team will receive {teamAllocation.allocationBps / 100}% of the total
    supply. This amount will be locked for {cliffDurationDays} days (cliff period),
    after which it will gradually unlock over {vestingDurationDays} days.
  </div>
</div>
