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

  let width: number, height: number;
  let ref: HTMLDivElement;
  function getLanguageFromURL(): LanguageCode | null {
    const regex = new RegExp("[\\?&]lang=([^&#]*)");
    const results = regex.exec(window.location.search);
    return results === null
      ? null
      : (decodeURIComponent(results[1].replace(/\+/g, " ")) as LanguageCode);
  }
  export let memebid: MCMemeInfoWithReference;

  onMount(() => {
    const widgetOptions: ChartingLibraryWidgetOptions = {
      theme: "dark",
      symbol: memebid.symbol,
      time_frames: [
        { text: "1m", resolution: "1" },
        { text: "5m", resolution: "5" },
        { text: "15m", resolution: "15" },
        { text: "30m", resolution: "30" },
        { text: "1h", resolution: "60" },
        { text: "1d", resolution: "1D" },
      ] as { text: string; resolution: ResolutionString }[],
      // BEWARE: no trailing slash is expected in feed URL
      datafeed: createDataFeed($ws),
      interval: "1" as ResolutionString,
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

      width,
      height,
    };

    new widget(widgetOptions);
  });

  let isInteracted = false;
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
