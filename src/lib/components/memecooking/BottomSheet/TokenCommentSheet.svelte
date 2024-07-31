<script lang="ts">
  import TokenComment from "../Board/TokenComment.svelte";

  import { BottomSheetContent } from "$lib/layout/BottomSheet";

  export let id: string;
</script>

<BottomSheetContent variant="shitzu">
  <slot slot="header">
    <h2 class="prose prose-invert prose-shitzu px-4 text-2xl">Comment</h2>
  </slot>
  <TokenComment {id} />
</BottomSheetContent>
