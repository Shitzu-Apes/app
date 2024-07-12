<script lang="ts">
  import McStake from "../Board/MCStake.svelte";

  import { BottomSheetContent } from "$lib/layout/BottomSheet";

  export let meme_id: number;
</script>

<BottomSheetContent variant="shitzu">
  <slot slot="header">
    <h2 class="prose prose-invert prose-shitzu px-4 text-2xl">Stake</h2>
  </slot>

  <McStake {meme_id} />
</BottomSheetContent>
