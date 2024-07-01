<script lang="ts">
  import { onMount } from "svelte";

  import {
    widget,
    type ChartingLibraryWidgetOptions,
    type LanguageCode,
    type ResolutionString,
  } from "$lib/charting_library";
  import { UDFCompatibleDatafeed } from "$lib/datafeeds/udf";

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
    const widgetOptions: ChartingLibraryWidgetOptions = {
      theme: "dark",
      symbol: "AAPL",
      // BEWARE: no trailing slash is expected in feed URL
      datafeed: new UDFCompatibleDatafeed(
        "https://demo_feed.tradingview.com",
        undefined,
        {
          maxResponseLength: 1000,
          expectedOrder: "latestFirst",
        },
      ),
      interval: "1H" as ResolutionString,
      container: ref,
      library_path: "/charting_library/",

      locale: getLanguageFromURL() || "en",
      disabled_features: ["use_localstorage_for_settings"],
      enabled_features: ["study_templates"],
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
</script>

<div
  class="h-full w-full"
  bind:this={ref}
  bind:clientHeight={height}
  bind:clientWidth={width}
></div>
