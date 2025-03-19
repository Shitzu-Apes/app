<script lang="ts">
  import Tooltip from "$lib/components/Tooltip.svelte";

  export let value: string | undefined = undefined;

  // Options for start time
  const options = [
    { label: "immediately", value: undefined },
    {
      label: "in 1 hour",
      value: (Date.now() + 60 * 60 * 1000).toString(),
    },
    {
      label: "in 6 hours",
      value: (Date.now() + 6 * 60 * 60 * 1000).toString(),
    },
    {
      label: "in 12 hours",
      value: (Date.now() + 12 * 60 * 60 * 1000).toString(),
    },
    {
      label: "in 24 hours",
      value: (Date.now() + 24 * 60 * 60 * 1000).toString(),
    },
    { label: "Custom", value: "custom" },
  ];

  let selectedOption = options[0];
  let customDate: string = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);

  $: {
    if (selectedOption.value === "custom") {
      value = new Date(customDate).getTime().toString();
    } else {
      value = selectedOption.value;
    }
  }

  function handleOptionChange(option: (typeof options)[0]) {
    selectedOption = option;
  }
</script>

<div class="space-y-2">
  <label
    for="start-time"
    class="flex items-center gap-1 text-base text-shitzu-4 font-600"
  >
    Start Time
    <Tooltip
      info="When your token sale will begin. If unset, it starts immediately."
    >
      <div class="size-4 i-mdi:information-outline text-amber-5" />
    </Tooltip>
  </label>

  <div class="grid gap-2 grid-cols-2 sm:grid-cols-3">
    {#each options as option}
      <button
        type="button"
        class={`px-4 py-2 rounded flex-1 basis-0 ${
          selectedOption === option
            ? "bg-shitzu-4 text-white"
            : "bg-gray-800 text-white"
        } focus:outline-none border border-white`}
        on:click={() => handleOptionChange(option)}
      >
        {option.label}
      </button>
    {/each}
  </div>

  {#if selectedOption.value === "custom"}
    <div class="mt-2">
      <label for="custom-date" class="text-sm text-shitzu-4"
        >Custom start time:</label
      >
      <input
        type="datetime-local"
        id="custom-date"
        bind:value={customDate}
        min={new Date().toISOString().slice(0, 16)}
        class="w-full p-2 bg-gray-700 rounded text-white border border-gray-600 mt-1"
      />
    </div>
  {/if}

  {#if value !== undefined}
    <div class="text-sm text-shitzu-4 mt-1">
      {value === "custom"
        ? "Custom time selected"
        : `Token sale will start at ${new Date(parseInt(value)).toLocaleString()}`}
    </div>
  {/if}
</div>
