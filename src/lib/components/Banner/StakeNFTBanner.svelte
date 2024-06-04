<script lang="ts">
  import { bind } from "svelte-simple-modal";

  import SHITZU_FACE from "$lib/assets/logo/shitzu_face.svg";
  import { Button, BuyNft } from "$lib/components";
  import { ModalSize, modal$, modalSize$ } from "$lib/layout";

  function handleOpenNftBuyDialog() {
    modalSize$.set(ModalSize.Small);
    modal$.set(bind(BuyNft, {}));
  }
</script>

<div class="flex flex-col not-prose text-black">
  <h2 class="text-base font-bold">APR Boost</h2>
  <div class="text-sm">
    SHITZU Revival NFT stakers enjoy an additional boost of 25% on all
    <span class="font-bold">$DOGSHIT</span> claims.
  </div>

  <div class="flex justify-evenly items-center mt-5">
    <Button
      class="bg-lime text-black font-bold text-sm rounded-lg px-5 py-2 flex items-center w-[45%] justify-center"
      onClick={handleOpenNftBuyDialog}
    >
      <img src={SHITZU_FACE} alt="SHITZU" class="w-6 h-6 -ml-2 mr-1" />
      Buy NFT
    </Button>
    <Button href="/account">
      <div class="i-mdi:stars size-6 mr-2" />
      Stake NFT
    </Button>
  </div>
</div>
