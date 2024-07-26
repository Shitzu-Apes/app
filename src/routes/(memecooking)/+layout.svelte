<script lang="ts">
  import "@unocss/reset/tailwind.css";
  import "virtual:uno.css";
  import "../../app.scss";

  import Snackbar, { Actions, Label } from "@smui/snackbar";
  import { onDestroy, onMount } from "svelte";
  import { cubicIn, cubicOut } from "svelte/easing";
  import { blur } from "svelte/transition";

  import Toast from "$lib/components/memecooking/Toast.svelte";
  import { BottomSheet } from "$lib/layout/BottomSheet";
  import MCHeader from "$lib/layout/memecooking/MCHeader.svelte";
  import {
    handleCloseSnackbar,
    snackbar$,
    snackbarComponent$,
  } from "$lib/snackbar";
  import { initializeWebsocket, ws } from "$lib/store/memebids";

  onMount(() => {
    initializeWebsocket($ws);
  });

  onDestroy(() => {
    $ws.close();
  });

  $: snackbarClass$ = $snackbarComponent$?.class$;
  $: snackbarCanClose$ = $snackbarComponent$?.canClose$;
</script>

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

{#key "memecooking"}
  <BottomSheet variant="shitzu" />

  <div
    in:blur={{ duration: 500, delay: 500, easing: cubicIn }}
    out:blur={{ duration: 500, easing: cubicOut }}
    class="w-full h-screen bg-dark"
  >
    <div class="text-white min-h-screen">
      <MCHeader />
      <slot />
      <div class="fixed bottom-0 right-0 p-2 text-xs text-white bg-gray-800">
        commit: {import.meta.env.VITE_COMMIT_HASH}
      </div>
    </div>
  </div>
  <Toast />
{/key}
