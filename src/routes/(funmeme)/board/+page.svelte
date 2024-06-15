<script lang="ts">
  import TokenList from "$lib/components/funmeme/Board/TokenList.svelte";
</script>

<div class="flex flex-col justify-center items-center gap-4 my-2">
  <a href="/create">
    <h1 class="text-2xl font-500">[start a new coin]</h1>
  </a>

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
    />
    <button class="bg-shitzu-5 px-4 py-2 rounded-lg">Search</button>
  </div>

  <section class="px-2 md:px-12 w-full">
    <TokenList />
  </section>
</div>
