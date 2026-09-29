<script lang="ts">
  import Shitstar from "./Shitstar.svelte";

  import { BottomSheetContent } from "$lib/layout/BottomSheet";

  export let token_id: string;
</script>

<BottomSheetContent variant="lime">
  <slot slot="header">
    <h2 class="prose prose-invert prose-lime px-4 text-2xl">
      Shitstar Details
    </h2>
  </slot>
  <section class="px-3 py-6 text-white h-[80vh] overflow-y-auto">
    <Shitstar {token_id} />
  </section>
</BottomSheetContent>

<style>
  section {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  section::-webkit-scrollbar {
    display: none;
  }
</style>
