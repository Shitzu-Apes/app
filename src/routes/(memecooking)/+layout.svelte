<script lang="ts">
  import "@unocss/reset/tailwind.css";
  import "virtual:uno.css";
  import "../../app.scss";

  import Snackbar, { Actions, Label } from "@smui/snackbar";
  import { reconnect, watchAccount } from "@wagmi/core";
  import { onDestroy, onMount } from "svelte";
  import { cubicIn, cubicOut } from "svelte/easing";
  import { get } from "svelte/store";
  import { blur } from "svelte/transition";

  import { client } from "$lib/api/client";
  import Tooltip from "$lib/components/Tooltip.svelte";
  import Toast from "$lib/components/memecooking/Toast.svelte";
  import { BottomSheet } from "$lib/layout/BottomSheet";
  import MCHeader from "$lib/layout/memecooking/MCHeader.svelte";
  import { ScreenSize } from "$lib/models";
  import { wagmiConfig, wallet } from "$lib/near";
  import { screenSize$ } from "$lib/screen-size";
  import {
    handleCloseSnackbar,
    snackbar$,
    snackbarComponent$,
  } from "$lib/snackbar";
  import {
    indexer_last_block_height$,
    node_last_block_height$,
  } from "$lib/store/indexer";
  import { initializeWebsocket, ws } from "$lib/store/memebids";
  import { readAndSetReferral } from "$lib/util/referral";

  onMount(() => {
    const initWebSocket = () => {
      initializeWebsocket($ws);
    };

    initWebSocket(); // Initialize WebSocket immediately
    readAndSetReferral();

    const fetchLastBlockHeight = async () => {
      const res = await client.GET("/info");

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

      $indexer_last_block_height$ = res.data?.last_block_height ?? null;
      $node_last_block_height$ = data.result.sync_info.latest_block_height;
    };

    fetchLastBlockHeight(); // Fetch once immediately

    let blockHeightInterval = setInterval(fetchLastBlockHeight, 10000);

    // Check and reestablish WebSocket connection if closed
    let wsCheckInterval = setInterval(() => {
      if ($ws.readyState === WebSocket.CLOSED) {
        console.log("WebSocket connection closed. Attempting to reconnect...");
        $ws = new WebSocket(import.meta.env.VITE_MEME_COOKING_WS_URL);
        $ws.onopen = () => {
          console.log("[ws.onopen]: Connection opened");
          $ws.send(JSON.stringify({ action: "subscribe" }));
        };
        initWebSocket();
      }
    }, 5000);

    return () => {
      clearInterval(blockHeightInterval);
      clearInterval(wsCheckInterval);
    };
  });

  onDestroy(() => {
    $ws.close();
  });

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

  onMount(() => {
    reconnect(wagmiConfig);

    watchAccount(wagmiConfig, {
      onChange: async (data) => {
        const selector = await get(wallet.selector$);
        if (!data.address || selector.store.getState().selectedWalletId) {
          return;
        }
        selector.wallet("ethereum-wallets").then((wallet) => {
          // FIXME optional access key not yet supported by wallet selector
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          wallet.signIn({} as any);
        });
      },
    });
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
      <div class="fixed bottom-0 right-0 p-2 text-xs text-white bg-gray-800/70">
        <div class="flex items-center gap-1">
          <Tooltip
            info="Red: Indexer >105 blocks behind. Green: Indexer up-to-date or slightly behind."
          >
            {#if $indexer_last_block_height$ && $node_last_block_height$}
              {#if $node_last_block_height$ - $indexer_last_block_height$ > 105}
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
              <span class="font-mono"
                >{$indexer_last_block_height$} ({$node_last_block_height$ -
                  $indexer_last_block_height$})</span
              >
            {/if}
          </Tooltip>
          <Tooltip info="commit: {import.meta.env.VITE_COMMIT_HASH}">
            <div class="i-mdi:git" />
          </Tooltip>
        </div>
      </div>
    </div>
  </div>
  <Toast />
{/key}
