<script lang="ts">
  import { client } from "$lib/api/client";
  import SHITZU_KING from "$lib/assets/shitzu_saiya.webp";
  import Board from "$lib/components/memecooking/Board/Board.svelte";
  import King from "$lib/components/memecooking/Board/King.svelte";
  import TokenCommentSection from "$lib/components/memecooking/Board/TokenCommentSection.svelte";
  import { wallet } from "$lib/near";
  import { requiredStake } from "$lib/near/memecooking";
  import { searchQuery$ } from "$lib/store/memebids";

  let currentKing = client.GET("/meme/king");
</script>

<div class="flex flex-col items-center gap-4 mt-2 min-h-screen">
  <button
    on:click={() => {
      wallet.login();
    }}
  >
    Login
  </button>
  <TokenCommentSection
    meme={{
      meme_id: 1,
      owner: "spareemail6210.testnet",
      end_timestamp_ms: 1715136000000,
      name: "SHITZU",
      symbol: "SHITZU",
      decimals: 8,
      reference: "https://shitzu.ai",
      reference_hash: "0x0",
      deposit_token_id: "0x0",
      last_change_ms: 1715136000000,
      total_supply_num: 9000,
      created_blockheight: 1,
      created_timestamp_ms: 1715136000000,
      total_deposit: "9000",
      total_deposit_fees: "0",
      coronated_at_ms: 1715136000000,
      total_withdraw_fees: "0",
      total_deposit_fees_num: 0,
      total_withdraw_fees_num: 0,
      total_deposit_num: 9000,
      description: "SHITZU",
      image:
        "https://plum-necessary-chameleon-942.mypinata.cloud/ipfs/QmdjWJmYMrHvfk8MF7Q4QqzrbvTBTEDgmsSZcZBBb2KbrA",
      is_finalized: true,
      pool_id: 4369,
      telegramLink: "",
      twitterLink: "",
      website: "",
      token_id: "",
      total_supply: "1000000",
    }}
  />

  <a href="/create">
    <h1 class="text-2xl font-500">[start a new coin]</h1>
  </a>

  <div class="flex items-center">
    <h2 class="text-memecooking-4 text-center font-bold">
      <div class="text-xl">It's OVER</div>
      <div class="text-3xl">9000!</div>
    </h2>
    <img src={SHITZU_KING} alt="shitzu king" class="size-24" />
  </div>
  {#await Promise.all([currentKing, requiredStake])}
    <div class="flex gap-4 items-center">
      <div class="loader size-24" />
      <div class="flex flex-col gap-2">
        <!-- Created by -->
        <div class="loader w-40 h-4" />
        <!-- MCap -->
        <div class="loader w-50 h-4" />
        <!-- replies -->
        <div class="loader w-20 h-2" />
        <!-- Ticker -->
        <div class="loader w-50 h-5" />
      </div>
    </div>
  {:then [data, requiredStake]}
    <King king={data.data} {requiredStake} />
  {/await}

  <!-- Search box -->
  <div class="flex justify-center items-center gap-2 w-full my-10 text-black">
    <input
      type="text"
      class="w-full max-w-sm h-10 border bg-shitzu-2 border-shitzu-4 rounded-lg px-4"
      placeholder="search for token"
      bind:value={$searchQuery$}
    />
    <button class="bg-shitzu-5 px-4 py-2 rounded-lg">Search</button>
  </div>
  <section class="w-full">
    <Board />
  </section>
</div>
