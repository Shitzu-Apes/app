<script lang="ts">
  import { onMount } from "svelte";

  import Terminal from "./Desktop/Terminal.svelte";
  import TokenCarousel from "./TokenCarousel.svelte";

  import { replaceState } from "$app/navigation";
  import { page } from "$app/stores";
  import { MCsubscribe, MCunsubscribe, memebids } from "$lib/store/memebids";
  import { isMobile } from "$lib/util";

  export let currentMemebidsIdx: number;
  export let initialMemebidsPromise: Promise<void>;

  const symbol = Symbol("main_feed");

  onMount(() => {
    MCsubscribe(symbol, async (newMemeInfo) => {
      const idx = $memebids.findIndex((b) => b.meme_id === newMemeInfo.meme_id);
      const meme = $memebids[idx];
      meme.total_deposit = newMemeInfo.total_deposit;
      meme.total_deposit_fees = newMemeInfo.total_deposit_fees;
      meme.last_change_ms = Date.now();

      $memebids = [
        meme,
        ...$memebids.filter((b) => b.meme_id !== meme.meme_id),
      ];
    });

    return () => {
      MCunsubscribe(symbol);
    };
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
