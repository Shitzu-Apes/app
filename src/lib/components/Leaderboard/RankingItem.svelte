<script lang="ts">
  import Squircle from "../Squircle.svelte";

  import { useNftTokenQuery } from "$lib/api/queries/nft";
  import type { FixedNumber } from "$lib/util";

  export let token_id: string;
  export let initial_account_id: string | null;
  export let score: FixedNumber;
  export let rank: number;
  export let isCurrentUser: boolean = false;

  const BASE_URL = import.meta.env.VITE_NFT_BASE_URL;

  // Fetch the token data to get the actual owner
  const tokenQuery = useNftTokenQuery(token_id, initial_account_id === null);

  // Use the owner from the query if available, otherwise use the provided account_id
  $: account_id = isCurrentUser
    ? "You"
    : initial_account_id === null
      ? $tokenQuery.isSuccess && $tokenQuery.data?.owner_id
        ? $tokenQuery.data.owner_id
        : "Loading..."
      : initial_account_id;
</script>

<li
  class="flex justify-center items-center text-white py-3 px-3 border-b first:border-t border-lime last:border-none {isCurrentUser
    ? 'bg-lime/50'
    : ''}"
>
  <a href="/shitstars/{token_id}" class="mr-3">
    <Squircle class="size-18 text-lime" src="{BASE_URL}/{token_id}.png" />
  </a>

  <div class="max-w-[200px]">
    <div class="font-light text-lg text-ellipsis overflow-hidden">
      {account_id}
    </div>
    <div class="font-bold text-base flex items-center">
      <div class="i-mdi:stars size-5 mr-1" />
      {score.format()}
    </div>
  </div>

  <div
    class="ml-auto text-2xl flex justify-center items-center bg-lime size-6 text-black rounded-full text-xs font-bold"
  >
    {rank}
  </div>
</li>
