<script lang="ts">
  import Terminal from "./Desktop/Terminal.svelte";
  import TokenCarousel from "./TokenCarousel.svelte";

  import { replaceState } from "$app/navigation";
  import { page } from "$app/stores";
  import { MCsubscribe, memebids } from "$lib/store/memebids";
  import { isMobile } from "$lib/util";

  export let currentMemebidsIdx: number;
  export let initialMemebidsPromise: Promise<void>;

  MCsubscribe(Symbol("main_feed"), async (newMemeInfo) => {
    if (isMobile()) {
      const idx = $memebids.findIndex((b) => b.meme_id === newMemeInfo.meme_id);

      if (idx === currentMemebidsIdx) {
        return;
      }
      return;
    }

    // console.log(
    //   "[bump] newMemeInfo last_change_ms",
    //   newMemeInfo.last_change_ms,
    // );
    // console.log(
    //   "[bump] $memebids max last_change_ms",
    //   Math.max(...$memebids.map((b) => b.last_change_ms)),
    // );
    // // bump new meme to the top
    // memebids.set([
    //   newMemeInfo,
    //   ...$memebids.filter((b) => b.meme_id !== newMemeInfo.meme_id),
    // ]);
    // $memebids = $memebids;
    // console.log("[bump] $memebids", $memebids);
    const idx = $memebids.findIndex((b) => b.meme_id === newMemeInfo.meme_id);
    const meme = $memebids[idx];
    meme.total_deposit = newMemeInfo.total_deposit;
    meme.total_deposit_fees = newMemeInfo.total_deposit_fees;
    meme.last_change_ms = Date.now();

    $memebids = [meme, ...$memebids.filter((b) => b.meme_id !== meme.meme_id)];
  });

  async function onSelect(event: CustomEvent<number>) {
    const idx = event.detail;
    currentMemebidsIdx = idx;
    if (idx === -1) {
      replaceState("/board", $page.state);
      return;
    }

    const id = $memebids[idx].meme_id;

    if (!id) return;

    replaceState(`/${id}`, $page.state);
  }
</script>

<button
  on:click={() => {
    // simulate MCSubscribe
    // pick one from the array (not the first)
    const idx = Math.floor(Math.random() * ($memebids.length - 1)) + 1;
    const meme = $memebids[idx];
    meme.last_change_ms = Date.now();
    console.log("[bump] meme", meme);
    $memebids = [meme, ...$memebids.filter((b) => b.meme_id !== meme.meme_id)];
  }}
>
  bump
</button>

{#if isMobile()}
  <TokenCarousel
    {initialMemebidsPromise}
    memebids={$memebids}
    {currentMemebidsIdx}
    on:select={onSelect}
  />
{:else}
  <Terminal {initialMemebidsPromise} memebids={$memebids} />
{/if}
