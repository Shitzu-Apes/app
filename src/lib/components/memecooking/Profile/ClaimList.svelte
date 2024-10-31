<script lang="ts">
  import type { FinalExecutionOutcome } from "@near-wallet-selector/core";

  import VirtualMemeList from "../VirtualMemeList.svelte";

  import type { Meme } from "$lib/api/client";
  import type { FixedNumber } from "$lib/util";

  export let claims: {
    token_id: string;
    amount: FixedNumber;
    meme: Meme;
  }[];
  export let isOwnAccount: boolean = false;
  export let update: (
    outcome: FinalExecutionOutcome | FinalExecutionOutcome[] | undefined,
  ) => void;
</script>

<VirtualMemeList
  items={claims.map((claim) => ({
    meme: claim.meme,
    claimAmount: claim.amount,
  }))}
  {isOwnAccount}
  {update}
  emptyMessage="No Token Held"
/>
