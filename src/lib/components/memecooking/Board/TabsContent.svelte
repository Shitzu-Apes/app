<script lang="ts">
  import Terminal from "./Desktop/Terminal.svelte";
  import TokenCarousel from "./TokenCarousel.svelte";

  import { replaceState } from "$app/navigation";
  import { page } from "$app/stores";
  import { MCsubscribe, memebids } from "$lib/store/memebids";
  import { isMobile } from "$lib/util";

  export let currentMemebidsIdx: number;
  export let initialMemebidsPromise: Promise<void>;

  MCsubscribe(Symbol("main_feed"), (newMemeInfo) => {
    const idx = $memebids.findIndex((b) => b.id === newMemeInfo.id);

    if (idx === currentMemebidsIdx) {
      return;
    }

    if (idx === -1) {
      $memebids = [...$memebids, newMemeInfo];
    }
  });

  async function onSelect(event: CustomEvent<number>) {
    const idx = event.detail;
    currentMemebidsIdx = idx;
    if (idx === -1) {
      replaceState("/board", $page.state);
      return;
    }

    const id = $memebids[idx].id;

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
