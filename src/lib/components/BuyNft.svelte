<!-- module -->
<script lang="ts" context="module">
  import MintBaseLogo from "$lib/assets/logo/MintBase.png";
  import MitteLogo from "$lib/assets/logo/Mitte.jpg";
  import ParasLogo from "$lib/assets/logo/Paras.png";
  import TradeportLogo from "$lib/assets/logo/Tradeport.png";

  export const NFT_LINKS = [
    {
      platform: "Paras",
      logo: ParasLogo,
      link: "https://paras.id/collection/shitzu.bodega-lab.near",
    },
    {
      platform: "MintBase",
      logo: MintBaseLogo,
      link: "https://www.mintbase.xyz/contract/shitzu.bodega-lab.near/nfts/all/0",
    },
    {
      platform: "Mitte",
      logo: MitteLogo,
      link: "https://beta.mitte.gg/?contractAddress=shitzu.bodega-lab.near",
    },
    {
      platform: "Tradeport",
      logo: TradeportLogo,
      link: "https://tradeport.xyz/near/collection/shitzu.bodega-lab.near",
    },
  ];
</script>

<div class="flex flex-col w-[90%] mx-auto justify-center items-center">
  <h1 class="text-2xl text-lime mb-6">Buy SHITZU Revival</h1>
  <ul class="flex flex-wrap justify-between items-center gap-5 mt-3">
    {#each NFT_LINKS as { platform, logo, link }}
      <li
        class="flex-[1_1_4rem] min-w-[10rem] py-2 bg-lime hover:bg-lime-5 text-black font-bold text-xl rounded-xl"
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
</div>
