<!-- module -->
<script lang="ts" context="module">
  import ParasLogo from "$lib/assets/logo/Paras.png";
  import TradeportLogo from "$lib/assets/logo/Tradeport.png";
  import { BottomSheetContent } from "$lib/layout/BottomSheet";

  export const NFT_LINKS = [
    {
      platform: "Tradeport",
      logo: TradeportLogo,
      link: "https://tradeport.xyz/near/collection/shitzu.bodega-lab.near",
    },
    {
      platform: "Paras",
      logo: ParasLogo,
      link: "https://paras.id/collection/shitzu.bodega-lab.near",
    },
  ];
</script>

<BottomSheetContent>
  <slot slot="header">
    <h1 class="text-2xl text-lime mr-auto mx-3">Buy SHITZU Revival</h1>
  </slot>
  <slot>
    <ul
      class="flex flex-col justify-between items-center gap-5 mt-3 max-w-[90%] mx-auto"
    >
      {#each NFT_LINKS as { platform, logo, link }}
        <li
          class="w-full py-2 bg-lime hover:bg-lime-5 text-black font-bold text-xl rounded-xl"
        >
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center justify-center gap-2"
          >
            <img src={logo} alt={platform} class="w-9 h-9 rounded-full" />
            {platform}
          </a>
        </li>
      {/each}
    </ul>
  </slot>
</BottomSheetContent>
<div class="flex flex-col w-[90%] mx-auto justify-center items-center"></div>
