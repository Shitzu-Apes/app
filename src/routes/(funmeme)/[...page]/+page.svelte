<script lang="ts">
  import { replaceState } from "$app/navigation";
  import { page } from "$app/stores";
  import SHITZU_KING from "$lib/assets/shitzu_saiya.webp";
  import TokenList from "$lib/components/funmeme/Board/TokenList.svelte";
  import type { MemeBid } from "$lib/models/funmeme";
  import { MemeCooking } from "$lib/near";

  let memebids: Promise<MemeBid[]> = MemeCooking.getLatestMeme(
    $page.params.page,
  );

  let currentMemebidsIdx = 0;

  async function onSelect(event: CustomEvent<number>) {
    const idx = event.detail;
    currentMemebidsIdx = idx;
    if (idx === -1) {
      replaceState("/board", $page.state);
      return;
    }

    const id = (await memebids)[idx].id;

    if (!id) return;

    replaceState(`/${id}`, $page.state);
  }
</script>

<div class="flex flex-col justify-center items-center gap-4 mt-2 min-h-screen">
  <a href="/create">
    <h1 class="text-2xl font-500">[start a new coin]</h1>
  </a>

  <div class="flex items-center">
    <h2 class="text-funmeme-4 text-center font-bold">
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
    />
    <button class="bg-shitzu-5 px-4 py-2 rounded-lg">Search</button>
  </div>

  <div class="flex items-center justify-center text-base text-shitzu-4">
    &leftarrow;&uparrow;&downarrow;&rightarrow; Use arrow keys to navigate
  </div>
  <section class="w-full max-w-lg">
    {#await memebids}
      Loading
    {:then memebids}
      <TokenList {memebids} {currentMemebidsIdx} on:select={onSelect} />
    {/await}
  </section>
</div>
