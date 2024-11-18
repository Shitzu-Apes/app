<script lang="ts">
  import { onMount } from "svelte";

  import type { Trade } from "$lib/api/client";
  import { FixedNumber } from "$lib/util";
  import { timesAgo } from "$lib/util/timesAgo";

  export let trade: Trade & { tokenAmount: number };

  let timeAgoText: string;
  let timer: ReturnType<typeof setTimeout>;

  function updateTimeAgo() {
    timeAgoText = timesAgo(new Date(trade.timestamp_ms!));

    // Calculate time difference in seconds
    const diffSeconds = Math.floor((Date.now() - trade.timestamp_ms!) / 1000);

    // Set update interval based on time difference
    let updateInterval = 1000; // Default 1 second

    if (diffSeconds >= 3600) {
      // > 1 hour
      updateInterval = 3600000; // Update every hour
    } else if (diffSeconds >= 60) {
      // > 1 minute
      updateInterval = 60000; // Update every minute
    }

    timer = setTimeout(updateTimeAgo, updateInterval);
  }

  onMount(() => {
    updateTimeAgo();
    return () => clearTimeout(timer);
  });
</script>

<li
  class="flex [&>*]:mx-[0.1rem] justify-between items-center p-2 text-white text-xs"
>
  <span class="flex-[0.15_0_3rem] text-start">
    {timeAgoText}
  </span>
  <span class="flex-[0.1_0_2rem] text-start">
    <span
      class={`inline-flex items-center justify-center w-5 h-5 rounded-full ${trade.is_deposit ? "bg-green-500" : "bg-red-500"}`}
    >
      {trade.is_deposit ? "D" : "W"}
    </span>
  </span>
  <span class="flex-[0.2_0_4rem] text-start">
    {new FixedNumber(trade.amount, 24).format()}
  </span>
  <span class="flex-[0.2_0_4rem] text-start overflow-hidden text-ellipsis">
    <a
      href="/profile/{trade.account_id}"
      class="hover:text-shitzu-4 hover:underline hover:font-bold"
    >
      {trade.account_id}
    </a>
  </span>
  <a
    href="{import.meta.env.VITE_NEARBLOCKS_URL}/hash/{trade.receipt_id}"
    target="_blank"
    rel="noopener noreferrer"
    class="flex-[0.2_0_4rem] text-start hover:text-shitzu-4 hover:underline hover:font-bold overflow-hidden text-ellipsis"
  >
    {trade.receipt_id.slice(0, 4)}...{trade.receipt_id.slice(-4)}
  </a>
</li>
