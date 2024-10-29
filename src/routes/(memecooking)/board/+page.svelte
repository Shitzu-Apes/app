<script lang="ts">
  import Board from "$lib/components/memecooking/Board/Board.svelte";
  import { searchQuery$ } from "$lib/store/memebids";
</script>

<div class="flex flex-col items-center gap-4 mt-2 min-h-screen">
  <a href="/create">
    <h1 class="text-2xl font-500 hover:font-bold">[start a new token]</h1>
  </a>

  <!-- Search box -->
  <div class="flex justify-center items-center gap-2 w-full text-black">
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
