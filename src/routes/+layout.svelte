<script lang="ts">
  import "../app.scss";

  import { mdiClose } from "@mdi/js";
  import IconButton, { Icon } from "@smui/icon-button";
  import Snackbar, { Actions, Label } from "@smui/snackbar";
  import dayjs from "dayjs";
  import localizedFormat from "dayjs/plugin/localizedFormat";
  import { onMount, onDestroy } from "svelte";
  import { Modal } from "svelte-simple-modal";

  import type { PageData } from "./$types";

  import { Footer, Header, modal$, Body, modalCanClose$ } from "$lib/layout";
  import { ScreenSize } from "$lib/models";
  import { screenSize$ } from "$lib/screen-size";
  import {
    handleCloseSnackbar,
    snackbar$,
    snackbarComponent$,
  } from "$lib/snackbar";

  export let data: PageData;

  // eslint-disable-next-line import/no-named-as-default-member
  dayjs.extend(localizedFormat);

  let resizeObserver: ResizeObserver;
  onMount(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { inlineSize } = entry.contentBoxSize[0];
        if (inlineSize <= ScreenSize.Phone) {
          screenSize$.set(ScreenSize.Phone);
        } else if (inlineSize <= ScreenSize.Mobile) {
          screenSize$.set(ScreenSize.Mobile);
        } else if (inlineSize <= ScreenSize.Laptop) {
          screenSize$.set(ScreenSize.Laptop);
        } else if (inlineSize <= ScreenSize.DesktopLg) {
          screenSize$.set(ScreenSize.DesktopLg);
        } else {
          screenSize$.set(ScreenSize.DesktopXl);
        }
      }
    });

    resizeObserver.observe(window.document.body);
  });
  onDestroy(() => {
    if (!resizeObserver) return;
    resizeObserver.unobserve(window.document.body);
  });

  $: snackbarClass$ = $snackbarComponent$?.class$;
  $: snackbarCanClose$ = $snackbarComponent$?.canClose$;
</script>

<Modal
  show={$modal$}
  closeButton={$modalCanClose$}
  closeOnEsc={$modalCanClose$}
  closeOnOuterClick={$modalCanClose$}
  styleWindow={{
    width: "var(--modal-width)",
    maxWidth: "100vw",
    maxHeight: "var(--modal-max-height)",
    margin: "auto",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    backgroundColor: "rgb(23 29 23)",
    border: "2px solid var(--bright-border)",
    boxShadow: "rgb(141 229 177) 0px 0px 1rem",
  }}
  styleWindowWrap={{
    margin: "0",
  }}
  styleCloseButton={{
    cursor: "pointer",
    borderRadius: "25%",
  }}
  styleContent={{
    maxHeight: "100%",
    display: "flex",
    flexDirection: "column",
  }}
/>

<Snackbar
  leading
  bind:this={$snackbar$}
  timeoutMs={$snackbarComponent$?.timeout ?? -1}
  class={$snackbarClass$ ?? ""}
  on:SMUISnackbar:closed={handleCloseSnackbar}
>
  <Label>
    {#if $snackbarComponent$}
      {#if $snackbarComponent$.type === "text"}
        {$snackbarComponent$.text}
      {:else if $snackbarComponent$.type === "component"}
        <svelte:component
          this={$snackbarComponent$.component}
          {...$snackbarComponent$.props}
        />
      {/if}
    {/if}
  </Label>
  <Actions>
    {#if $snackbarCanClose$}
      <IconButton class="material-icons" title="Dismiss">
        <Icon tag="svg" viewBox="0 0 24 24">
          <path fill="currentColor" d={mdiClose} />
        </Icon>
      </IconButton>
    {/if}
  </Actions>
</Snackbar>

<Header isTG={data.isTG} />
<Body>
  <slot />
</Body>
<Footer />

<style lang="scss">
  :root {
    --modal-width: 0;
    --modal-max-height: 0;
  }

  :global(.snackbar-success .mdc-snackbar__surface) {
    background-color: var(--color-bg-ok);
  }
  :global(.snackbar-error .mdc-snackbar__surface) {
    background-color: var(--color-bg-err);
  }

  :global(.section-field) {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0 0 0.3rem;
    margin: 0;
  }
  :global(.section-field:first-child) {
    padding-top: 0;
  }
  :global(.section-field:not(:last-child)) {
    border-bottom: 1px solid var(--color-border);
    padding-bottom: 0.6rem;
  }
  :global(.section-field-gap) {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  :global(.field > :first-child) {
    font-size: 1.2rem;
  }
</style>
