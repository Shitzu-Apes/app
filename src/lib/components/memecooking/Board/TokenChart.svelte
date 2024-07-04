<script lang="ts">
  import { onMount } from "svelte";

  import {
    widget,
    type ChartingLibraryWidgetOptions,
    type LanguageCode,
    type ResolutionString,
  } from "$lib/charting_library";
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

  onMount(() => {
    const widgetOptions: ChartingLibraryWidgetOptions = {
      theme: "dark",
      symbol: "moon",
      // BEWARE: no trailing slash is expected in feed URL
      datafeed: createDataFeed($ws),
      interval: "1" as ResolutionString,
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
