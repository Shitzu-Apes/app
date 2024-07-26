<script lang="ts">
  import MCStake from "../Board/MCStake.svelte";

  import { BottomSheetContent } from "$lib/layout/BottomSheet";
  import type { MCMemeInfoWithReference } from "$lib/models/memecooking";

  export let meme: MCMemeInfoWithReference;
</script>

<BottomSheetContent variant="shitzu">
  <slot slot="header">
    <h2 class="prose prose-invert prose-shitzu px-4 text-2xl">Stake</h2>
  </slot>

  <MCStake {meme} />
</BottomSheetContent>
