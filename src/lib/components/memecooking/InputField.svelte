<script lang="ts">
  export let value: string;
  export let placeholder: string = "(optional)";
  export let label: string;

  export let validate: (value: string) => string;

  $: error = value ? validate(value) : "";
</script>

<label for="name" class="block text-sm text-shitzu-4 font-600"> {label} </label>
<input
  id="website"
  type="text"
  bind:value
  {placeholder}
  class="w-full p-2 bg-gray-700 rounded text-white border border-white"
  autocomplete="off"
/>
{#if error}
  <div
    class="bg-red-300 text-black text-xs px-2 rounded-full w-fit flex items-center gap-1 py-0.5"
  >
    <div class="size-4 i-mdi:alert-circle bg-red-600" />
    {error}
  </div>
{/if}
