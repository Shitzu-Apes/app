<script lang="ts">
  import Donation from "./Donation.svelte";

  import { BottomSheetContent } from "$lib/layout/BottomSheet";
</script>

<BottomSheetContent>
  <slot slot="header">
    <div>
      <p class="text-lime-3 text-base mx-3">
        Staked NFT of the donor will receive shitstars equal to 4x donation
        amount and donated amount will help fund shitzu boost activity
      </p>
    </div>
  </slot>

  <slot>
    <div class="w-[90%] mx-auto">
      <Donation />
    </div>
  </slot>
</BottomSheetContent>
