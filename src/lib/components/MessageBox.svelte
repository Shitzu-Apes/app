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
  class:error={type === "error"}
  class:warning={type === "warning"}
  class:info={type === "info"}
>
  {#if type === "error"}
    <svg
      viewBox="0 0 24 24"
      style={`min-height: ${size};max-height: ${size};min-width: ${size};max-width: ${size};`}
    >
      <path fill="var(--color-err)" d={mdiAlertCircleOutline} />
    </svg>
  {:else if type === "warning"}
    <svg
      viewBox="0 0 24 24"
      style={`min-height: ${size};max-height: ${size};min-width: ${size};max-width: ${size};`}
    >
      <path fill="var(--color-warn)" d={mdiAlertOutline} />
    </svg>
  {:else if type === "info"}
    <svg
      viewBox="0 0 24 24"
      style={`min-height: ${size};max-height: ${size};min-width: ${size};max-width: ${size};`}
    >
      <path fill="var(--color-info)" d={mdiInformationSlabCircle} />
    </svg>
  {/if}
  <slot />
</p>

<style lang="scss">
  p {
    display: flex;
    align-items: center;
    border-radius: 0.4rem;
    padding: 0.4rem;
    gap: 0.4rem;
  }

  .error {
    border: to-rem(2px) solid var(--color-err);
  }

  .warning {
    border: to-rem(2px) solid var(--color-warn);
  }

  .info {
    border: to-rem(2px) solid var(--color-info);
  }
</style>
