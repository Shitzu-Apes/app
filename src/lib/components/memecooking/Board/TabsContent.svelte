<script lang="ts">
  import Terminal from "./Desktop/Terminal.svelte";
  import TokenCarousel from "./TokenCarousel.svelte";

  import { replaceState } from "$app/navigation";
  import { page } from "$app/stores";
  import { memebids$ } from "$lib/store/memebids";

  export let currentMemebidsIdx: number;

  async function onSelect(event: CustomEvent<number>) {
    const idx = event.detail;
    currentMemebidsIdx = idx;
    if (idx === -1) {
      replaceState("/board", $page.state);
      return;
    }
    const memebids = await $memebids$;
    const id = memebids[idx].meme_id;

    if (!id) return;

    replaceState(`/${id}`, $page.state);
  }
</script>

<div class="mobile">
  <TokenCarousel {currentMemebidsIdx} on:select={onSelect} />
</div>
<div class="desktop">
  <Terminal />
</div>

<style lang="scss">
  .mobile {
    display: none;
  }
  .desktop {
    display: contents;
  }

  @include breakpoint(mobile, max) {
    .mobile {
      display: contents;
    }
    .desktop {
      display: none;
    }
  }
</style>
