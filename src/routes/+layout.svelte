<script lang="ts">
  import "@unocss/reset/tailwind.css";
  import "virtual:uno.css";
  import "../app.scss";

  import Snackbar, { Actions, Label } from "@smui/snackbar";
  import dayjs from "dayjs";
  import localizedFormat from "dayjs/plugin/localizedFormat";
  import { onMount, onDestroy } from "svelte";
  import { Modal } from "svelte-simple-modal";

  import { Footer, Header, modal$, Body, modalCanClose$ } from "$lib/layout";
  import { ScreenSize } from "$lib/models";
  import { screenSize$ } from "$lib/screen-size";
  import {
    handleCloseSnackbar,
    snackbar$,
    snackbarComponent$,
  } from "$lib/snackbar";

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

<div class="bg-gradient-to-r bg-gradient-from-cyan bg-gradient-to-blue">
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
        <button
          class="i-mdi:close text-red-3 cursor-pointer w-5 h-5 absolute top-2 right-2 cursor-pointer rounded-full hover:bg-red-3/15"
          on:click={() => {
            $snackbar$.close();
          }}
        />
      {/if}
    </Actions>
  </Snackbar>
</div>

<div class="bg-[#222] min-h-screen w-screen max-w-full">
  <div
    class="flex flex-col min-h-screen prose prose-invert prose-lime mx-auto max-w-none"
  >
    <Header />
    <Body>
      <slot />
    </Body>
    <Footer />
  </div>
</div>
