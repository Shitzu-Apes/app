<script lang="ts">
  import {
    mdiAlertCircleOutline,
    mdiAlertOutline,
    mdiInformationSlabCircle,
  } from "@mdi/js";
  import { Icon } from "@smui/common";

  export let type: "error" | "warning" | "info" = "info";

  const size = "1.6rem";
</script>

<p
  class:error={type === "error"}
  class:warning={type === "warning"}
  class:info={type === "info"}
>
  {#if type === "error"}
    <Icon
      tag="svg"
      viewBox="0 0 24 24"
      style={`min-height: ${size};max-height: ${size};min-width: ${size};max-width: ${size};`}
    >
      <path fill="var(--color-err)" d={mdiAlertCircleOutline} />
    </Icon>
  {:else if type === "warning"}
    <Icon
      tag="svg"
      viewBox="0 0 24 24"
      style={`min-height: ${size};max-height: ${size};min-width: ${size};max-width: ${size};`}
    >
      <path fill="var(--color-warn)" d={mdiAlertOutline} />
    </Icon>
  {:else if type === "info"}
    <Icon
      tag="svg"
      viewBox="0 0 24 24"
      style={`min-height: ${size};max-height: ${size};min-width: ${size};max-width: ${size};`}
    >
      <path fill="var(--color-info)" d={mdiInformationSlabCircle} />
    </Icon>
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
