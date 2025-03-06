<script lang="ts">
  import { format } from "d3-format";
  import { slide } from "svelte/transition";

  import rarity from "$lib/assets/rarity.json";
  import { Squircle } from "$lib/components";
  import { Rewarder, Nft } from "$lib/near";
  import type { ShitstarTrait } from "$lib/shitstars/type";
  import { FixedNumber } from "$lib/util";

  const RARITY = rarity as Record<string, Record<string, number>>;

  export let token_id: string;

  let token = Promise.all([
    Nft.nftToken(token_id),
    Rewarder.stakerOf(token_id),
    Rewarder.scoreOf(token_id),
    fetch(`${import.meta.env.VITE_NFT_BASE_URL}/${token_id}.json`).then((res) =>
      res.json(),
    ) as Promise<{
      name: string;
      description: string;
      image: string;
      dna: string;
      edition: number;
      date: number;
      attributes: ShitstarTrait[];
    }>,
  ]).then(([nftToken, staker, score, trait]) => {
    const owner = staker ? staker : nftToken.owner_id;

    return {
      owner,
      nftToken,
      staker,
      score: new FixedNumber(score, 18),
      trait,
    };
  });
</script>

<main class="not-prose w-full flex flex-col items-center justify-center">
  {#await token}
    <div transition:slide class="i-svg-spinners:pulse-3 size-40" />
  {:then token}
    <div class="w-full" transition:slide>
      <div class="w-full flex gap-3 mb-6 mt-3">
        <div class="relative">
          <Squircle
            src="{import.meta.env.VITE_NFT_BASE_URL}/{token_id}.png"
            class="{token.staker ? 'text-lime' : 'text-red'} size-32"
          />

          <!-- Badge for staker/non-staker bottom-center -->
          <div class="absolute bottom-0 left-0 right-0 flex justify-center">
            <div
              class="{token.staker
                ? 'bg-lime'
                : 'bg-red'} text-black text-xs px-1 py-0.5 rounded-full"
            >
              {#if token.staker}
                <div class="flex items-center gap-1">
                  <div class="i-mdi:check-decagram size-4" />
                  Staked
                </div>
              {:else}
                Not Staked
              {/if}
            </div>
          </div>
        </div>
        <div class="flex flex-col justify-center flex-1 overflow-hidden">
          <div>
            Shitzu Revival #{token_id}
          </div>
          <h2 class="text-xl flex items-center gap-1">
            <span class="truncate">{token.owner}</span>
          </h2>
          <div
            class="flex items-center gap-1 text-lg bg-lime w-fit rounded-full px-2 text-black mt-1"
          >
            <div class="i-mdi:stars" />
            {token.score.format()}
          </div>
        </div>
      </div>

      <ul
        class="w-full flex flex-wrap justify-center bg-black border border-lime rounded-xl overflow-hidden"
      >
        {#each token.trait.attributes as { trait_type, value }}
          <li
            class="w-full bg-black flex justify-between items-center border-b border-lime last:border-transparent px-2 py-2"
          >
            <div class="flex flex-col">
              <span class="text-gray-3 text-sm">{trait_type}</span>
              <span class="my-1">{value}</span>
            </div>
            <span
              class="text-sm bg-red/25 text-red-4 w-fit px-2 rounded min-w-20 text-center py-1"
              >{format(".2%")(RARITY[trait_type][value])}</span
            >
          </li>
        {/each}
      </ul>
    </div>
  {/await}
</main>
