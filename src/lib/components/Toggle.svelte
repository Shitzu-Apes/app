<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let isOn = false;

  const dispatch = createEventDispatcher();
</script>

<div class="flex items-center">
  <slot />
  <div class="relative flex items-center text-gray-500 text-sm">
    <div
      class="absolute w-1/2 h-full rounded bg-shitzu-4 {isOn
        ? 'left-0'
        : 'right-0'} transition-all duration-300"
    />

    <button
      class="px-1 z-1"
      on:click={() => {
        isOn = true;
        dispatch("toggle", true);
      }}>On</button
    >
    <button
      class="px-1 z-1"
      on:click={() => {
        isOn = false;
        dispatch("toggle", false);
      }}>Off</button
    >
  </div>
</div>
