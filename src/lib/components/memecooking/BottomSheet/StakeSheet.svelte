<script lang="ts">
  import McActionBox from "../Board/MCActionBox.svelte";

  import { BottomSheetContent } from "$lib/layout/BottomSheet";
  import type { Meme } from "$lib/models/memecooking";

  export let meme: Meme;
</script>

<BottomSheetContent variant="shitzu">
  <slot slot="header">
    <h2 class="prose prose-invert prose-shitzu px-4 text-2xl">Deposit</h2>
  </slot>

  <McActionBox {meme} />
</BottomSheetContent>
