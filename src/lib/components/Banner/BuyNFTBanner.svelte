<script lang="ts">
  import { bind } from "svelte-simple-modal";

  import SHITZU_FACE from "$lib/assets/logo/shitzu_face.svg";
  import { BuyNft } from "$lib/components";
  import { NFT_LINKS } from "$lib/components/BuyNft.svelte";
  import { ModalSize, modal$, modalSize$ } from "$lib/layout";

  function handleOpenNftBuyDialog() {
    modalSize$.set(ModalSize.Small);
    modal$.set(bind(BuyNft, {}));
  }
</script>

<div class="flex flex-col not-prose text-black">
  <h2 class="text-base font-bold">SHITZU Revival NFT</h2>
  <div class="text-sm">
    Stake SHITZU Revival NFT as your primary NFT and start accumulating
    <div class="inline-flex font-bold items-center align-bottom">
      <div class="i-mdi:stars size-4 mr-1" />
      Shitstars
    </div>
  </div>

  <div class="flex justify-between items-center mt-5">
    <ul class="flex">
      {#each NFT_LINKS as { platform, logo }}
        <li class="first:pl-2 -ml-2">
          <img src={logo} alt={platform} class="w-9 h-9 rounded-full" />
        </li>
      {/each}
    </ul>
    <button
      class="bg-lime text-black font-bold text-sm rounded-lg px-5 py-2 flex items-center"
      on:click={handleOpenNftBuyDialog}
    >
      <img src={SHITZU_FACE} alt="SHITZU" class="w-6 h-6 -ml-2 mr-1" />
      Buy NFT
    </button>
  </div>
</div>
