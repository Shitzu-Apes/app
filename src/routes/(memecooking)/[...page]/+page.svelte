<script lang="ts">
  import { client, type Meme } from "$lib/api/client";
  import SHITZU_KING from "$lib/assets/shitzu_saiya.webp";
  import Board from "$lib/components/memecooking/Board/Board.svelte";
  // import { MemeCooking } from "$lib/near";
  import { memebids } from "$lib/store/memebids";
  import { search } from "$lib/util/search";

  let cacheMemebids: Meme[] = [];

  let initialMemebidsPromise: Promise<void> = client
    .GET("/meme")
    .then((res) => {
      if (!res.data) return;
      console.log("[+page] memebids", res.data);
      $memebids = res.data;
      cacheMemebids = $memebids;
    });
  let query = "";

  $: {
    if (query.length > 0) {
      cacheMemebids = $memebids;
      $memebids = search($memebids, query);
    } else {
      $memebids = cacheMemebids;
    }
  }

  let currentMemebidsIdx = 0;
</script>

<div class="flex flex-col items-center gap-4 mt-2 min-h-screen">
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

  <!-- Search box -->
  <div class="flex justify-center items-center gap-2 w-full my-10 text-black">
    <input
      type="text"
      class="w-full max-w-sm h-10 border bg-shitzu-2 border-shitzu-4 rounded-lg px-4"
      placeholder="search for token"
      bind:value={query}
    />
    <button class="bg-shitzu-5 px-4 py-2 rounded-lg">Search</button>
  </div>

  <div class="flex items-center justify-center text-base text-shitzu-4">
    &leftarrow;&uparrow;&downarrow;&rightarrow; Use arrow keys to navigate
  </div>
  <section class="w-full">
    <Board {initialMemebidsPromise} {currentMemebidsIdx} />
  </section>
</div>
