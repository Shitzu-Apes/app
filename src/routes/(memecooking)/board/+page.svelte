<script lang="ts">
  import { client } from "$lib/api/client";
  import SHITZU_KING from "$lib/assets/shitzu_saiya.webp";
  import Board from "$lib/components/memecooking/Board/Board.svelte";
  import King from "$lib/components/memecooking/Board/King.svelte";
  import { requiredStake } from "$lib/near/memecooking";
  import { searchQuery$ } from "$lib/store/memebids";

  let currentKing = client.GET("/meme/king");
</script>

<div class="flex flex-col items-center gap-4 mt-2 min-h-screen">
  <a href="/create">
    <h1 class="text-2xl font-500 hover:font-bold">[start a new token]</h1>
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
      class="w-full max-w-sm h-10 border bg-shitzu-2 border-shitzu-4 rounded-lg px-4 placeholder:text-emerald-5"
      placeholder="search for token"
      bind:value={$searchQuery$}
    />
    <button class="bg-shitzu-5 px-4 py-2 rounded-lg">Search</button>
  </div>
  <section class="w-full">
    <Board />
  </section>
</div>
