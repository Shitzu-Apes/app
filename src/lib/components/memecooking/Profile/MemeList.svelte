<script lang="ts">
  import type { FinalExecutionOutcome } from "@near-wallet-selector/core";

  import VirtualMemeList from "../VirtualMemeList.svelte";

  import type { Meme } from "$lib/api/client";
  import type { McAccount } from "$lib/near/memecooking";
  import type { FixedNumber } from "$lib/util";

  export let props:
    | { type: "not-finalized"; data: McAccount["deposits"] }
    | { type: "finalized"; data: McAccount["claims"] }
    | { type: "created"; data: McAccount["created"] };
  export let isOwnAccount: boolean = false;
  export let update: (
    outcome: FinalExecutionOutcome | FinalExecutionOutcome[] | undefined,
  ) => void;

  let items: Array<{
    meme: Meme;
    meme_id?: number;
    amount?: string;
    token_id?: string;
    claimAmount?: FixedNumber;
  }> = [];
  let emptyMessage = "No Tokens Found";

  $: {
    if (props.type === "not-finalized") {
      // Handle deposits
      items = props.data.map((deposit) => ({
        meme: deposit.meme,
        amount: deposit.amount,
      }));
      emptyMessage = "No Tokens Held";
    } else if (props.type === "finalized") {
      // Handle claims
      items = props.data.map((claim) => ({
        meme: claim.meme,
        claimAmount: claim.amount,
      }));
      emptyMessage = "No Claims Found";
    } else if (props.type === "created") {
      // Handle created coins
      items = props.data.map((coin) => ({
        meme: coin,
      }));
      emptyMessage = "No Tokens Created";
    }
  }
</script>

<VirtualMemeList {items} {isOwnAccount} {update} {emptyMessage} />
