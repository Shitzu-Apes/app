<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let enabled: boolean = false;
  const dispatch = createEventDispatcher();

  function toggle() {
    dispatch("toggle");
  }
</script>

<button
  class={`w-12 h-6 rounded-full transition-colors duration-200 ease-in-out relative ${enabled ? "bg-shitzu-4" : "bg-gray-700"}`}
  on:click={toggle}
>
  <div
    class={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-in-out ${
      enabled ? "translate-x-6" : ""
    }`}
  />
</button>
