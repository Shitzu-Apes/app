<script lang="ts">
  import "@unocss/reset/tailwind.css";
  import "virtual:uno.css";
  import "../app.scss";

  import { QueryClientProvider } from "@tanstack/svelte-query";
  import { SvelteQueryDevtools } from "@tanstack/svelte-query-devtools";
  import dayjs from "dayjs";
  import duration from "dayjs/plugin/duration";
  import relativeTime from "dayjs/plugin/relativeTime";
  import { onDestroy, onMount } from "svelte";
  import { derived, get } from "svelte/store";

  import { client } from "$lib/api/client";
  import { queryClient } from "$lib/api/queries";
  import LazySheet from "$lib/components/LazySheet.svelte";
  import Toast from "$lib/components/Toast.svelte";
  import Tooltip from "$lib/components/Tooltip.svelte";
  import { BottomSheet } from "$lib/layout/BottomSheet";
  import { openBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
  import MCHeader from "$lib/layout/memecooking/MCHeader.svelte";
  import { ScreenSize } from "$lib/models";
  import { nearWallet } from "$lib/near";
  import { MemeCooking } from "$lib/near/memecooking";
  import { rpcFetch } from "$lib/near/rpc-retry";
  import { screenSize$ } from "$lib/screen-size";
  import {
    initializeWebsocket,
    MCMemeSubscribe,
    ws,
  } from "$lib/store/MCWebSocket";
  import { initializeExternalWebsocket } from "$lib/store/externalTrades";
  import {
    indexer_last_block_height$,
    indexer_last_seen_block_height$,
    node_last_block_height$,
  } from "$lib/store/indexer";
  import { appendNewMeme } from "$lib/store/memebids";
  import { readAndSetReferral } from "$lib/util/referral";

  // eslint-disable-next-line import/no-named-as-default-member
  dayjs.extend(duration);
  // eslint-disable-next-line import/no-named-as-default-member
  dayjs.extend(relativeTime);

  onMount(() => {
    const initWebSocket = () => {
      initializeWebsocket($ws);
    };

    initWebSocket(); // Initialize WebSocket immediately
    const externalWs = initializeExternalWebsocket(); // Initialize external trades websocket
    readAndSetReferral();

    const fetchLastBlockHeight = async () => {
      try {
        const [res, status] = await Promise.all([
          client.GET("/info"),
          rpcFetch<{
            sync_info: { latest_block_height: number };
          }>(import.meta.env.VITE_NODE_URL, { method: "status", params: [] }),
        ]);

        $indexer_last_block_height$ = res.data?.last_block_height ?? null;
        $indexer_last_seen_block_height$ =
          res.data?.last_seen_block_height ??
          res.data?.last_block_height ??
          null;
        $node_last_block_height$ = status.sync_info.latest_block_height;
      } catch (error) {
        // Keep the last known heights rather than throwing inside setInterval.
        console.warn("[layout]: failed to refresh block heights", error);
      }
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
    // Loaded on the first idle slot: the EVM/wagmi stack is only needed for the
    // wallet dropdown and used to be the biggest part of the initial bundle.
    const startEvm = async () => {
      const [{ reconnect, watchAccount }, { wagmiConfig }] = await Promise.all([
        import("@wagmi/core"),
        import("$lib/evm/wallet"),
      ]);

      reconnect(wagmiConfig);

      watchAccount(wagmiConfig, {
        onChange: async (data) => {
          const selector = await get(nearWallet.selector$);
          if (
            data.address != null &&
            selector.store.getState().selectedWalletId == null
          ) {
            selector.wallet("ethereum-wallets").then((wallet) => {
              // FIXME optional access key not yet supported by wallet selector
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              wallet.signIn({} as any);
            });
          }
          if (
            data.address == null &&
            selector.store.getState().selectedWalletId === "ethereum-wallets"
          ) {
            selector.wallet("ethereum-wallets").then((wallet) => {
              wallet.signOut();
            });
          }
        },
      });
    };

    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(() => void startEvm(), { timeout: 2000 });
    } else {
      window.setTimeout(() => void startEvm(), 1000);
    }
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

      openBottomSheet(LazySheet, {
        loader: () =>
          import(
            "$lib/components/memecooking/BottomSheet/RegisterSheet.svelte"
          ),
        props: { accountId, transactions },
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
      openBottomSheet(LazySheet, {
        loader: () =>
          import("$lib/components/memecooking/BottomSheet/LaunchSheet.svelte"),
      });
    }
  });

  onMount(() => {
    const symbol = Symbol("new_meme");
    MCMemeSubscribe(symbol, appendNewMeme);
  });
</script>

<QueryClientProvider client={queryClient}>
  {#key "memecooking"}
    <BottomSheet variant="shitzu" />

    <div class="w-full container mx-auto bg-dark">
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
              {#if $indexer_last_seen_block_height$ && $node_last_block_height$}
                {#if $node_last_block_height$ - $indexer_last_seen_block_height$ > 105}
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
                  >{$indexer_last_seen_block_height$} ({$node_last_block_height$ -
                    $indexer_last_seen_block_height$})</span
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
  <SvelteQueryDevtools />
</QueryClientProvider>
