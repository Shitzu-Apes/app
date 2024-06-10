<script lang="ts">
  import Donation from "./Donation.svelte";

  import { BottomSheetContent } from "$lib/layout/BottomSheet";
</script>

<BottomSheetContent>
  <slot slot="header">
    <h1 class="text-xl text-lime mr-auto mx-3">Support SHITZU</h1>
  </slot>

  <slot>
    <div class="w-[90%] mx-auto">
      <Donation />
    </div>
  </slot>
</BottomSheetContent>
