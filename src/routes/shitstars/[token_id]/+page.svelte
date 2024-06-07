<script lang="ts">
  import { format } from "d3-format";

  import type { PageData } from "./$types";

  import rarity from "$lib/assets/rarity.json";
  import { Squircle } from "$lib/components";
  import { Rewarder, Nft } from "$lib/near";
  import { FixedNumber } from "$lib/util";

  const RARITY = rarity as Record<string, Record<string, number>>;

  export let data: PageData;
  const {
    props: { token_id },
  } = data;

  type Background = "Black Dragon" | "Cosmos" | "Garden" | "Doghouse" | "Pool";
  type Base = "Base";
  type Clothes =
    | "Astronaut"
    | "Kimono"
    | "Naked"
    | "Puffer Jacket"
    | "Aurora Swag"
    | "Dogtag"
    | "Jumper"
    | "Floral"
    | "Resto Worker"
    | "Tux"
    | "NEAR Swag"
    | "Tank Top";
  type Eyes =
    | "NVG"
    | "Dizzy"
    | "Visor"
    | "Disguise"
    | "Eyepatch"
    | "Blindfold"
    | "Heart Eyes"
    | "3D Glasses"
    | "Squeal"
    | "Crypto Laser Eyes"
    | "Monocle";
  type Headwears =
    | "Crown"
    | "Astronaut Helmet"
    | "None"
    | "Cowboy Hat"
    | "Hopping Zombie Hat"
    | "Clown"
    | "Noogler Hat"
    | "Funky Earring"
    | "Art hat"
    | "Viking"
    | "Afro";
  type Mouths =
    | "None"
    | "Dead Rat"
    | "Plushy"
    | "Dead Squirrel"
    | "Bone"
    | "Dogtoy"
    | "Party Blower"
    | "Growl"
    | "Pipe"
    | "Tongue out";

  type TraitType =
    | { trait_type: "Backgrounds"; value: Background }
    | { trait_type: "Base"; value: Base }
    | { trait_type: "Clothes"; value: Clothes }
    | { trait_type: "Eyes"; value: Eyes }
    | { trait_type: "Headwears"; value: Headwears }
    | { trait_type: "Mouths"; value: Mouths };

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
      attributes: TraitType[];
    }>,
  ]).then(([nftToken, staker, score, trait]) => {
    console.log({ nftToken, trait, staker, score });

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

<main class="not-prose w-full flex flex-col">
  <a href="/shitstars">
    <div class="i-mdi:chevron-left size-8" />
  </a>
  {#await token}
    <div class="i-svg-spinners:pulse-3 size-40" />
  {:then token}
    <div class="w-full">
      <div>
        <Squircle
          src="{import.meta.env.VITE_NFT_BASE_URL}/{token_id}.png"
          class="text-red-3 size-40"
        />
        {token.owner}
      </div>
      <div>
        {token.score.format()}
      </div>

      <ul class="w-full flex flex-wrap gap-3 justify-center">
        {#each token.trait.attributes as { trait_type, value }}
          <li
            class="w-[45%] bg-black flex flex-col py-2 px-2 rounded-xl border border-lime"
          >
            <span class="text-gray-3 text-sm">{trait_type}</span>
            <span class="my-1">{value}</span>
            <span class="text-sm bg-red/25 text-red w-fit px-2 rounded"
              >{format(".2%")(RARITY[trait_type][value])}</span
            >
          </li>
        {/each}
      </ul>
    </div>
  {/await}
</main>
