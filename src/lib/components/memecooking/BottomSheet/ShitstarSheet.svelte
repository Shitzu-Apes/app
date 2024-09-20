<script lang="ts">
  import MintBaseLogo from "$lib/assets/logo/MintBase.png";
  import MitteLogo from "$lib/assets/logo/Mitte.jpg";
  import ParasLogo from "$lib/assets/logo/Paras.png";
  import TradeportLogo from "$lib/assets/logo/Tradeport.png";
  import { BottomSheetContent } from "$lib/layout/BottomSheet";
  import { closeBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";

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

<BottomSheetContent variant="shitzu">
  <slot slot="header">
    <h2
      class="prose prose-invert prose-shitzu px-4 text-2xl font-bold text-shitzu-4"
    >
      What is Shitstars?
    </h2>
  </slot>
  <section class="text-white px-3 space-y-4 my-10">
    <div class="space-y-6">
      <span class="inline-block">
        Shitstars is a point and reputation system within the SHITZU ecosystem.
        It rewards users for their participation and contributions. The
        individual who earns the most Shitstars is also called the Shitstar.
      </span>
      <span class="inline-block">
        <strong class="text-shitzu-4 strong">
          What is the relationship between Shitstars and NFTs?
        </strong> Shitstars are attached to a single primary NFT, and remain attached
        even if the owner of the NFT changes.
      </span>
      <span class="inline-block">
        <strong class="text-shitzu-4 strong">How are Shitstars earned?</strong>
        Shitstars can be earned in four ways: donating $SHITZU, participating in
        Shitzu Boost, staking with Shitzu Pool and participating on meme.cooking.
        <br /><br />In addition, helping out community members in the SHITZU
        Telegram group can also earn you Shitstars. Join us on
        <a
          class="text-lightblue-3 hover:underline hover:font-bold"
          href="https://t.me/Shitzu_Community"
          target="_blank">[Telegram]</a
        > for more information.
      </span>
      <span class="inline-block">
        <strong class="text-shitzu-4 strong">
          How do I get started with earning Shitstars?
        </strong>
        To get started, you will need to acquire SHITZU Revival NFT,
        <a
          href="https://app.shitzuapes.xyz/account"
          target="_blank"
          class="text-lightblue-3 hover:underline hover:font-bold"
        >
          [stake here]</a
        >, and then follow the instructions for one of the four methods of
        earning Shitstars.
      </span>
      <span class="inline-block">
        <strong class="text-shitzu-4 strong">
          How do I earn Shitstars through meme.cooking?
        </strong>
        Participate in any <b>successful</b> meme.cooking launch. Once you claimed
        your tokens, you will also get rewarded with 69 Shitstars per deposited NEAR.
      </span>
      <span class="inline-block">
        <strong class="text-shitzu-4 strong">
          Where can I buy the Shitzu Revival NFT?
        </strong>
        You can buy the NFT on any of these platforms:
        <ul
          class="flex flex-wrap justify-between items-center gap-5 mt-3 max-w-[90%] mx-auto"
        >
          {#each NFT_LINKS as { platform, logo, link }}
            <li
              class="flex-[1_1_150px] py-2 bg-lime hover:bg-lime-5 text-black font-bold text-xl rounded-xl"
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
      </span>
    </div>
  </section>
  <button
    class="w-full text-white hover:font-bold mb-20"
    on:click={closeBottomSheet}
  >
    [close]
  </button>
</BottomSheetContent>
