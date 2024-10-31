<script lang="ts">
  import SHITZU_DETECTIVE from "$lib/assets/static/shitzu_detective.png";
  import Terminal from "$lib/components/memecooking/Board/Desktop/Terminal.svelte";
  import { searchQuery$ } from "$lib/store/memebids";
</script>

<div class="flex flex-col items-center gap-4 mt-2 min-h-screen">
  <a href="/create">
    <h1 class="text-2xl font-500 hover:font-bold">[start a new token]</h1>
  </a>

  <!-- Search box -->
  <div class="flex justify-center items-center gap-2 w-full">
    <div class="relative w-full max-w-sm">
      <input
        type="text"
        class="w-full h-10 pl-10 pr-4 bg-transparent border border-gray-100 text-white rounded focus:border-shitzu-3 focus:outline-none placeholder:text-gray-400"
        placeholder="search for meme"
        bind:value={$searchQuery$}
      />
      <img
        src={SHITZU_DETECTIVE}
        class="absolute size-5 left-3 top-1/2 -translate-y-1/2"
        alt="shitzu detective"
      />
    </div>
  </div>
  <section class="w-full">
    <Terminal />
  </section>
</div>
