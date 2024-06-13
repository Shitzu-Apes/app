<script lang="ts">
  import SHITZU_FACE from "$lib/assets/logo/shitzu_face.svg";
  import { Button, BuyNft } from "$lib/components";
  import { NFT_LINKS } from "$lib/components/BuyNft.svelte";
  import { openBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";

  export let variant: "large" | "small" = "large";

  function handleOpenNftBuyDialog() {
    openBottomSheet(BuyNft);
  }
</script>

<div class="flex flex-col not-prose text-black w-full">
  {#if variant === "large"}
    <h2 class="text-base font-bold">SHITZU Revival NFT</h2>
    <div class="text-sm">
      Stake SHITZU Revival NFT as your primary NFT and start accumulating
      <div class="inline-flex font-bold items-center align-bottom">
        <div class="i-mdi:stars size-4 mr-1" />
        Shitstars
      </div>
    </div>
  {/if}

  <div
    class="flex justify-between items-center {variant === 'large' && 'mt-5'}"
  >
    <ul class="flex">
      {#each NFT_LINKS as { platform, logo }}
        <li class="first:pl-2 -ml-2">
          <img src={logo} alt={platform} class="w-9 h-9 rounded-full" />
        </li>
      {/each}
    </ul>
    <Button onClick={handleOpenNftBuyDialog}>
      <img src={SHITZU_FACE} alt="SHITZU" class="w-6 h-6 -ml-2 mr-1" />
      Buy NFT
    </Button>
  </div>
</div>
