<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let slippage: number = 0.05; // Default 5% slippage

  const dispatch = createEventDispatcher();

  const slippageValues = [
    { value: 0.01, label: "1%" },
    { value: 0.03, label: "3%" },
    { value: 0.05, label: "5%" },
  ];

  function updateSlippage(value: number | string) {
    if (typeof value === "number") {
      slippage = value;
    } else {
      const parsedSlippage = parseFloat(value);
      if (
        !isNaN(parsedSlippage) &&
        parsedSlippage > 0 &&
        parsedSlippage <= 100
      ) {
        slippage = parsedSlippage / 100;
      } else {
        dispatch("invalidSlippage", {
          title: "Invalid Slippage",
          description: "Please enter a valid slippage percentage (0-100)",
        });
        slippage = 0.05; // Revert to default 5% slippage
      }
    }
    dispatch("update", slippage);
  }
</script>

<div class="flex flex-col gap-1">
  <label for="slippage" class="text-sm">Slippage: {slippage * 100}%</label>
  <div class="flex items-center space-x-2">
    <ul class="flex items-center gap-2">
      {#each slippageValues as slippageValue}
        <li class="text-sm bg-memecooking-5 px-2 rounded">
          <button
            class="text-black hover:text-shitzu-4"
            on:click={() => updateSlippage(slippageValue.value)}
          >
            {slippageValue.label}
          </button>
        </li>
      {/each}
      <li>
        <input
          type="text"
          value={slippage * 100}
          on:input={(e) => updateSlippage(e.currentTarget.value)}
          class="bg-transparent border border-gray-6 rounded px-2 py-1 w-16 text-sm"
        />
      </li>
    </ul>
    <span class="text-sm">%</span>
  </div>
</div>
