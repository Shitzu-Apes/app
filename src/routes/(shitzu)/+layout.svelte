<script lang="ts">
  import "@unocss/reset/tailwind.css";
  import "virtual:uno.css";
  import "../../app.scss";

  import Snackbar, { Actions, Label } from "@smui/snackbar";
  import dayjs from "dayjs";
  import localizedFormat from "dayjs/plugin/localizedFormat";
  import { onMount, onDestroy } from "svelte";
  import { cubicIn, cubicOut } from "svelte/easing";
  import { blur } from "svelte/transition";

  import { Footer, Header, Body } from "$lib/layout";
  import { BottomSheet } from "$lib/layout/BottomSheet";
  import { ScreenSize } from "$lib/models";
  import { wallet } from "$lib/near";
  import { screenSize$ } from "$lib/screen-size";
  import {
    handleCloseSnackbar,
    snackbar$,
    snackbarComponent$,
  } from "$lib/snackbar";
  import { refreshShitzuBalance } from "$lib/store";

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

  wallet.accountId$.subscribe((accountId) => {
    if (accountId == null) return;
    refreshShitzuBalance(accountId);
  });
</script>

<BottomSheet />

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

{#key "shitzu"}
  <div
    out:blur={{ duration: 500, easing: cubicOut }}
    in:blur={{ duration: 500, delay: 500, easing: cubicIn }}
    class="bg-[#222] min-h-screen w-screen max-w-full"
  >
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
{/key}
