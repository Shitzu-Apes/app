<script lang="ts">
  import type { FinalExecutionOutcome } from "@near-wallet-selector/core";

  import type { Meme } from "$lib/api/client";
  import VirtualMemeList from "$lib/components/memecooking/VirtualMemeList.svelte";

  export let deposits: {
    meme_id: number;
    amount: string;
    meme: Meme;
  }[];
  export let update: (
    outcome: FinalExecutionOutcome | FinalExecutionOutcome[] | undefined,
  ) => void;

  $: sortedDeposits = [...deposits].sort((a, b) => {
    if (!a.meme?.end_timestamp_ms || a.meme?.end_timestamp_ms < Date.now())
      return 1;
    if (!b.meme?.end_timestamp_ms || b.meme?.end_timestamp_ms < Date.now())
      return -1;
    return (a.meme?.end_timestamp_ms || 0) - (b.meme?.end_timestamp_ms || 0);
  });
</script>

<VirtualMemeList items={sortedDeposits} {update} emptyMessage="No Token Held" />
