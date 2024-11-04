<script lang="ts">
  import Tooltip from "../Tooltip.svelte";

  export let value: string | number;
  export let placeholder: string = "(optional)";
  export let label: string;

  export let validate: ((value: string | number) => string) | undefined =
    undefined;
  export let type: "text" | "number" = "text";
  export let min: number | undefined = undefined;
  export let max: number | undefined = undefined;
  export let step: number | undefined = undefined;
  export let tooltip: string | undefined = undefined;

  $: error = value && validate != null ? validate(value) : "";
</script>

<label
  for="name"
  class="block text-sm text-shitzu-4 font-600 flex items-center gap-1"
>
  {label}
  {#if tooltip}
    <Tooltip info={tooltip}>
      <div class="size-4 i-mdi:information-outline text-amber-5" />
    </Tooltip>
  {/if}
</label>
{#if type === "text"}
  <input
    type="text"
    bind:value
    {placeholder}
    class="w-full p-2 bg-gray-800 rounded text-white border border-white"
    autocomplete="off"
  />
{:else if type === "number"}
  <input
    type="number"
    bind:value
    {placeholder}
    class="w-full p-2 bg-gray-800 rounded text-white border border-white"
    autocomplete="off"
    {min}
    {max}
    {step}
  />
{/if}
{#if error}
  <div
    class="bg-red-300 text-black text-xs px-2 rounded-full w-fit flex items-center gap-1 py-0.5"
  >
    <div class="size-4 i-mdi:alert-circle bg-red-600" />
    {error}
  </div>
{/if}
