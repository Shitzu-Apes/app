<script lang="ts">
  import "@unocss/reset/tailwind.css";
  import "virtual:uno.css";
  import "../../app.scss";

  import { QueryClient, QueryClientProvider } from "@tanstack/svelte-query";
  import { reconnect, watchAccount } from "@wagmi/core";
  import dayjs from "dayjs";
  import duration from "dayjs/plugin/duration";
  import relativeTime from "dayjs/plugin/relativeTime";
  import { onDestroy, onMount } from "svelte";
  import { cubicIn, cubicOut } from "svelte/easing";
  import { derived, get } from "svelte/store";
  import { blur } from "svelte/transition";

  import { client } from "$lib/api/client";
  import Toast from "$lib/components/Toast.svelte";
  import Tooltip from "$lib/components/Tooltip.svelte";
  import LaunchSheet from "$lib/components/memecooking/BottomSheet/LaunchSheet.svelte";
  import RegisterSheet from "$lib/components/memecooking/BottomSheet/RegisterSheet.svelte";
  import { BottomSheet } from "$lib/layout/BottomSheet";
  import { openBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
  import MCHeader from "$lib/layout/memecooking/MCHeader.svelte";
  import { ScreenSize } from "$lib/models";
  import { wagmiConfig, nearWallet } from "$lib/near";
  import { MemeCooking } from "$lib/near/memecooking";
  import { screenSize$ } from "$lib/screen-size";
  import {
    initializeWebsocket,
    MCMemeSubscribe,
    ws,
  } from "$lib/store/MCWebSocket";
  import { initializeExternalWebsocket } from "$lib/store/externalTrades";
  import {
    indexer_last_block_height$,
    node_last_block_height$,
  } from "$lib/store/indexer";
  import { appendNewMeme, updateMemebids } from "$lib/store/memebids";
  import { readAndSetReferral } from "$lib/util/referral";

  // eslint-disable-next-line import/no-named-as-default-member
  dayjs.extend(duration);
  // eslint-disable-next-line import/no-named-as-default-member
  dayjs.extend(relativeTime);

  onMount(() => {
    updateMemebids();
  });

  onMount(() => {
    const initWebSocket = () => {
      initializeWebsocket($ws);
    };

    initWebSocket(); // Initialize WebSocket immediately
    const externalWs = initializeExternalWebsocket(); // Initialize external trades websocket
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

    let blockHeightInterval = setInterval(fetchLastBlockHeight, 60_000);

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
      externalWs.close();
    };
  });

  onDestroy(() => {
    $ws.close();
  });

  let resizeObserver: ResizeObserver | null = null;
  onMount(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { inlineSize } = entry.contentBoxSize[0];
        if (inlineSize <= ScreenSize.Phone) {
          screenSize$.set(ScreenSize.Phone);
        } else if (inlineSize <= ScreenSize.Mobile) {
          screenSize$.set(ScreenSize.Mobile);
        } else if (inlineSize <= ScreenSize.Tablet) {
          screenSize$.set(ScreenSize.Tablet);
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
    (resizeObserver as ResizeObserver).unobserve(window.document.body);
  });

  onMount(() => {
    reconnect(wagmiConfig);

    watchAccount(wagmiConfig, {
      onChange: async (data) => {
        const selector = await get(nearWallet.selector$);
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

  const { accountId$, walletId$ } = nearWallet;
  derived([accountId$, walletId$], (stores) => Promise.all(stores)).subscribe(
    async (stores) => {
      const [accountId, walletId] = await stores;
      if (!accountId || !walletId) return;
      const isEvm = walletId === "ethereum-wallets";
      if (!isEvm) return;

      const transactions = await MemeCooking.checkRegister(accountId);
      if (transactions.length === 0) return;

      openBottomSheet(RegisterSheet, {
        accountId,
        transactions,
      });
    },
  );

  onMount(async () => {
    if (import.meta.env.VITE_MEME_COOKING_CONTRACT_ID !== "meme-cooking.near")
      return;
    const isRunning = await MemeCooking.isRunning();
    if (
      !isRunning &&
      Date.now() < new Date("2024-09-30T15:01:00.000Z").valueOf()
    ) {
      openBottomSheet(LaunchSheet);
    }
  });

  onMount(() => {
    const symbol = Symbol("new_meme");
    MCMemeSubscribe(symbol, appendNewMeme);
  });

  let loading = true;
  onMount(async () => {
    try {
      let promises = [];
      let doBreak = false;
      for (let i = 0; i < 100_000; i += 1_000) {
        const poolPromise = Ref.getPools(i, 1_000).then((pools) => {
          if (pools.length < 1_000) {
            doBreak = true;
          }
        });
        promises.push(poolPromise);
        if (promises.length >= 5) {
          await Promise.all(promises);
          promises = [];
          if (doBreak) break;
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      loading = false;
    }
  });
  const queryClient = new QueryClient();
</script>

<QueryClientProvider client={queryClient}>
  {#key "memecooking"}
    <BottomSheet variant="shitzu" />

  <div
    in:blur={{ duration: 500, delay: 500, easing: cubicIn }}
    out:blur={{ duration: 500, easing: cubicOut }}
    class="w-full container mx-auto bg-dark"
  >
    <div class="text-white min-h-screen flex flex-col">
      <MCHeader />
      <slot />
      <div
        class="fixed bottom-0 right-0 p-2 text-xs text-white bg-gray-800/70 hidden sm:block"
      >
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
</QueryClientProvider>
