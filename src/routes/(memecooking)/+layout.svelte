<script lang="ts">
  import "@unocss/reset/tailwind.css";
  import "virtual:uno.css";
  import "../../app.scss";

  import Snackbar, { Actions, Label } from "@smui/snackbar";
  import { onDestroy, onMount } from "svelte";
  import { cubicIn, cubicOut } from "svelte/easing";
  import { blur } from "svelte/transition";

  import { client } from "$lib/api/client";
  import Toast from "$lib/components/memecooking/Toast.svelte";
  import { BottomSheet } from "$lib/layout/BottomSheet";
  import MCHeader from "$lib/layout/memecooking/MCHeader.svelte";
  import {
    handleCloseSnackbar,
    snackbar$,
    snackbarComponent$,
  } from "$lib/snackbar";
  import { initializeWebsocket, ws } from "$lib/store/memebids";

  let indexer_last_block_height: number | null = null;
  let node_last_block_height: number | null = null;

  onMount(() => {
    initializeWebsocket($ws);

    const fetchLastBlockHeight = async () => {
      const res = await client.GET("/info");
      indexer_last_block_height = res.data?.last_block_height ?? null;

      const nodeUrl = import.meta.env.VITE_NODE_URL;
      const response = await fetch(nodeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "dontcare",
          method: "status",
          params: [],
        }),
      });
      const data = await response.json();
      node_last_block_height = data.result.sync_info.latest_block_height;
    };

    fetchLastBlockHeight(); // Fetch once immediately

    let interval = setInterval(fetchLastBlockHeight, 10000);

    return () => {
      clearInterval(interval);
    };
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
        <div>
          commit: {import.meta.env.VITE_COMMIT_HASH}
        </div>
        <div>
          {#if indexer_last_block_height}
            {#if indexer_last_block_height && node_last_block_height}
              {#if node_last_block_height - indexer_last_block_height > 100}
                <span class="inline-flex relative mr-1">
                  <span class="w-2 h-2 bg-red-500 rounded-full"></span>
                  <span
                    class="w-2 h-2 bg-red-500 rounded-full absolute animate-ping"
                  ></span>
                </span>
              {:else}
                <span class="inline-flex relative mr-1">
                  <span class="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span
                    class="w-2 h-2 bg-green-500 rounded-full absolute animate-ping"
                  ></span>
                </span>
              {/if}
            {/if}
            last indexed block:
            <span class="font-mono">{indexer_last_block_height}</span>
          {/if}
        </div>
      </div>
    </div>
  </div>
  <Toast />
{/key}
