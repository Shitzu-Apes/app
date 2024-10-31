<script lang="ts">
  import type { FinalExecutionOutcome } from "@near-wallet-selector/core";

  import VirtualMemeList from "../VirtualMemeList.svelte";

  import type { Meme } from "$lib/api/client";

  export let coins: Meme[] | undefined;
  export let isOwnAccount: boolean = false;
  export let update: (
    outcome: FinalExecutionOutcome | FinalExecutionOutcome[] | undefined,
  ) => void;

  $: sortedCoins = coins?.sort(
    (a, b) => b.created_timestamp_ms - a.created_timestamp_ms,
  );
</script>

<VirtualMemeList
  items={sortedCoins?.map((coin) => ({ meme: coin })) || []}
  {isOwnAccount}
  {update}
  showCook={false}
  emptyMessage="No Token Created"
/>
