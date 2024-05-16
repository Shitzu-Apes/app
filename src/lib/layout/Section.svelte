<script lang="ts">
  import {
    mdiUnfoldMoreHorizontal,
    mdiUnfoldLessHorizontal,
    mdiCheckCircle,
    mdiAlertCircle,
    mdiAlert,
  } from "@mdi/js";
  import IconButton, { Icon } from "@smui/icon-button";
  import { Panel, Content, Header } from "@smui-extra/accordion";

  import ProgressSpinner from "$lib/components/ProgressSpinner.svelte";
  import type { Condition } from "$lib/models";

  export let header: string;
  export let condition: Condition;

  let panelOpen = true;
</script>

<Panel bind:open={panelOpen}>
  <Header>
    {#if condition === "ok"}
      <Icon tag="svg" viewBox="0 0 24 24" on>
        <path fill="var(--color-ok)" d={mdiCheckCircle} />
      </Icon>
    {:else if condition === "warn"}
      <Icon tag="svg" viewBox="0 0 24 24" on>
        <path fill="var(--color-warn)" d={mdiAlert} />
      </Icon>
    {:else if condition === "err"}
      <Icon tag="svg" viewBox="0 0 24 24" on>
        <path fill="var(--color-err)" d={mdiAlertCircle} />
      </Icon>
    {:else if condition === "loading"}
      <ProgressSpinner
        inline
        padding={0}
        width={32}
        height={32}
        --spinner-width="auto"
      />
    {/if}
    {header}
    <IconButton size="button" class="material-icons" toggle pressed={panelOpen}>
      <Icon tag="svg" viewBox="0 0 24 24" on>
        <path fill="currentColor" d={mdiUnfoldLessHorizontal} />
      </Icon>
      <Icon tag="svg" viewBox="0 0 24 24">
        <path fill="currentColor" d={mdiUnfoldMoreHorizontal} />
      </Icon>
    </IconButton>
  </Header>
  <Content>
    <slot />
  </Content>
</Panel>

<style lang="scss">
  :global(.smui-accordion__header__title) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 1.4rem;
    font-weight: 600;
  }

  :global(.smui-accordion__header__title svg) {
    height: 2rem;
  }
</style>
