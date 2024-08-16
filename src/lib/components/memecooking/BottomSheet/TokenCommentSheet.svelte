<script lang="ts">
  import TokenCommentSection from "../Board/TokenCommentSection.svelte";

  import { BottomSheetContent } from "$lib/layout/BottomSheet";
  import type { Meme } from "$lib/models/memecooking";

  export let meme: Meme;
</script>

<BottomSheetContent variant="shitzu">
  <slot slot="header">
    <h2 class="prose prose-invert prose-shitzu px-4 text-2xl">Comment</h2>
  </slot>
  <div class="p-2">
    <TokenCommentSection {meme} />
  </div>
</BottomSheetContent>
