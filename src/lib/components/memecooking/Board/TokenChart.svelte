<script lang="ts">
  import { onMount } from "svelte";

  import {
    widget,
    type ChartingLibraryWidgetOptions,
    type LanguageCode,
    type ResolutionString,
  } from "$lib/charting_library";
  import type { MCMemeInfoWithReference } from "$lib/models/memecooking";
  import createDataFeed from "$lib/models/memecooking/datafeed";
  import { ws } from "$lib/store/memebids";

  export let memebid: MCMemeInfoWithReference;
  export let touchToStart: boolean = false;

  let width: number, height: number;
  let ref: HTMLDivElement;
  function getLanguageFromURL(): LanguageCode | null {
    const regex = new RegExp("[\\?&]lang=([^&#]*)");
    const results = regex.exec(window.location.search);
    return results === null
      ? null
      : (decodeURIComponent(results[1].replace(/\+/g, " ")) as LanguageCode);
  }

  onMount(() => {
    const now = Date.now();
    const to =
      now < memebid.end_timestamp_ms! ? now : memebid.end_timestamp_ms!;
    const timeframe = {
      from: ~~(memebid.created_timestamp_ms / 1000),
      to: ~~(to / 1000),
    };

    let interval: ResolutionString;
    const duration = to - memebid.created_timestamp_ms;

    if (duration < 10 * 60 * 1000) {
      interval = "1" as ResolutionString;
    } else if (duration < 8 * 60 * 60 * 1000) {
      interval = "5" as ResolutionString;
    } else {
      interval = "15" as ResolutionString;
    }

    console.log("interval", interval);

    const widgetOptions: ChartingLibraryWidgetOptions = {
      theme: "dark",
      symbol: memebid.meme_id.toString(),
      time_frames: [
        { text: "1m", resolution: "1" },
        { text: "5m", resolution: "5" },
        { text: "15m", resolution: "15" },
        { text: "30m", resolution: "30" },
        { text: "1h", resolution: "60" },
        { text: "2h", resolution: "120" },
      ] as { text: string; resolution: ResolutionString }[],
      // BEWARE: no trailing slash is expected in feed URL
      datafeed: createDataFeed($ws),
      interval,
      container: ref,
      library_path: "/charting_library/",

      locale: getLanguageFromURL() || "en",
      disabled_features: [
        "symbol_search_hot_key",
        "header_quick_search",
        "header_symbol_search",
        "header_screenshot",
        "header_saveload",
        "header_indicators",
      ],
      enabled_features: [],
      charts_storage_url: "https://saveload.tradingview.com",
      charts_storage_api_version: "1.1",
      client_id: "tradingview.com",
      user_id: "public_user_id",
      fullscreen: false,
      autosize: true,
      timeframe,
      width,
      height,
      custom_formatters: {
        priceFormatterFactory: () => ({
          format: (price: number) => {
            if (!price) return "0";
            if (price < 0.0001) {
              return price.toFixed(12);
            }
            return price.toFixed(4);
          },
        }),
      },
    };

    const chart = new widget(widgetOptions);

    chart.onChartReady(() => {
      const priceScale = chart
        .activeChart()
        .getPanes()[0]
        .getRightPriceScales()[0];
      const DEFAULT_PRICE = 1e-8;
      const price =
        memebid.total_supply && parseFloat(memebid.total_supply) !== 0
          ? +memebid.total_deposit / +memebid.total_supply
          : DEFAULT_PRICE;
      priceScale.setVisiblePriceRange({ from: 0, to: price });
    });
  });

  let isInteracted = false || !touchToStart;
</script>

<div class="w-full h-full relative">
  <div
    class="h-full w-full"
    bind:this={ref}
    bind:clientHeight={height}
    bind:clientWidth={width}
  ></div>

  <!-- Tap to remove overlay to start interact with the chart -->
  {#if !isInteracted}
    <button
      class="absolute inset-0 flex items-center justify-center bg-shitzu-4/25"
      on:click={() => {
        isInteracted = true;
      }}
    >
      <div class="text-white text-2xl flex flex-col items-center gap-4">
        <div class="i-mdi:fingerprint size-24" />
        Tap to start interact with the chart
      </div>
    </button>
  {/if}
</div>
