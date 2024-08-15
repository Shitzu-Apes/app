<script lang="ts">
  import TokenCommentSection from "../Board/TokenCommentSection.svelte";

  import { BottomSheetContent } from "$lib/layout/BottomSheet";

  export let id: number;
  export let creator: string;
</script>

<BottomSheetContent variant="shitzu">
  <slot slot="header">
    <h2 class="prose prose-invert prose-shitzu px-4 text-2xl">Comment</h2>
  </slot>
  <TokenCommentSection {id} {creator} />
</BottomSheetContent>
