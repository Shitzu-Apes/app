<script lang="ts">
  export let type: "error" | "warning" | "info" = "info";
</script>

<p
  class="flex items-center border-2 rounded-xl p-2 gap-2"
  class:border-red-3={type === "error"}
  class:border-yellow-3={type === "warning"}
  class:border-blue-3={type === "info"}
>
  {#if type === "error"}
    <div class="w-6 h-6 text-red-3 i-mdi-alert-circle-outline" />
  {:else if type === "warning"}
    <div class="w-6 h-6 text-yellow-3 i-mdi-alert-outline" />
  {:else if type === "info"}
    <div class="w-6 h-6 text-blue-3 i-mdi-information-slab-circle" />
  {/if}
  <slot />
</p>
