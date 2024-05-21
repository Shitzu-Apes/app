<script lang="ts">
  import {
    mdiAlertCircleOutline,
    mdiAlertOutline,
    mdiInformationSlabCircle,
  } from "@mdi/js";

  export let type: "error" | "warning" | "info" = "info";

  const size = "1.6rem";
</script>

<p
  class="flex items-center border-2 rounded-xl p-2 gap-2"
  class:border-red-3={type === "error"}
  class:border-yellow-3={type === "warning"}
  class:border-blue-3={type === "info"}
>
  {#if type === "error"}
    <svg
      viewBox="0 0 24 24"
      style={`min-height: ${size};max-height: ${size};min-width: ${size};max-width: ${size};`}
    >
      <path class="fill-red-3" d={mdiAlertCircleOutline} />
    </svg>
  {:else if type === "warning"}
    <svg
      viewBox="0 0 24 24"
      style={`min-height: ${size};max-height: ${size};min-width: ${size};max-width: ${size};`}
    >
      <path class="fill-yellow-3" d={mdiAlertOutline} />
    </svg>
  {:else if type === "info"}
    <svg
      viewBox="0 0 24 24"
      style={`min-height: ${size};max-height: ${size};min-width: ${size};max-width: ${size};`}
    >
      <path class="fill-blue-3" d={mdiInformationSlabCircle} />
    </svg>
  {/if}
  <slot />
</p>
