<script lang="ts">
  import type { FinalExecutionOutcome } from "@near-wallet-selector/core";

  import LoadingLambo from "../Board/LoadingLambo.svelte";
  import VirtualMemeList from "../VirtualMemeList.svelte";

  import { page } from "$app/stores";
  import type { Meme } from "$lib/api/client";
  import {
    useDepositsQuery,
    useClaimsQuery,
    useCreatedMemesQuery,
  } from "$lib/api/queries/memes";
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

  $: accountId = $page.params.accountId;

  const depositsQuery = useDepositsQuery(accountId);
  const claimsQuery = useClaimsQuery(accountId);
  const createdQuery = useCreatedMemesQuery(accountId);

  let items: Array<{
    meme: Meme;
    meme_id?: number;
    amount?: string;
    token_id?: string;
    claimAmount?: FixedNumber;
  }> = [];
  let emptyMessage = "No Tokens Found";

  $: {
    if (props.type === "not-finalized" && $depositsQuery.data) {
      items = $depositsQuery.data.map((deposit) => ({
        meme: deposit.meme,
        amount: deposit.amount,
      }));
      emptyMessage = "No Tokens Held";
    } else if (props.type === "finalized" && $claimsQuery.data) {
      items = $claimsQuery.data.map((claim) => ({
        meme: claim.meme,
        claimAmount: claim.amount,
      }));
      emptyMessage = "No Claims Found";
    } else if (props.type === "created" && $createdQuery.data) {
      items = $createdQuery.data.map((coin) => ({
        meme: coin,
      }));
      emptyMessage = "No Tokens Created";
    }
  }
</script>

{#if props.type === "not-finalized" && $depositsQuery.isLoading}
  <LoadingLambo />
{:else if props.type === "finalized" && $claimsQuery.isLoading}
  <LoadingLambo />
{:else if props.type === "created" && $createdQuery.isLoading}
  <LoadingLambo />
{:else if props.type === "not-finalized" && $depositsQuery.isError}
  <div class="text-red-500">
    Error loading deposits: {$depositsQuery.error.message}
  </div>
{:else if props.type === "finalized" && $claimsQuery.isError}
  <div class="text-red-500">
    Error loading claims: {$claimsQuery.error.message}
  </div>
{:else if props.type === "created" && $createdQuery.isError}
  <div class="text-red-500">
    Error loading created memes: {$createdQuery.error.message}
  </div>
{:else}
  <VirtualMemeList {items} {isOwnAccount} {update} {emptyMessage} />
{/if}
