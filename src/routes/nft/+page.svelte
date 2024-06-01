<script lang="ts">
  import { FixedNumber } from "@tarnadas/fixed-number";

  import { wallet } from "$lib/near";
  import { view } from "$lib/near/utils";

  const { accountId$ } = wallet;

  let primaryNftTokenId = view<[string, string]>(
    "rewarder.test.near",
    "primary_nft_of",
    {
      account_id: "mireya_carroll.test.near",
    },
  ).then(async ([token_id, score]) => {
    const token = await view<{
      token_id: string;
      owner_id: string;
      metadata: {
        title: string | null;
        description: string | null;
        media: string | null;
        media_hash: string | null;
        copies: number | null;
        issued_at: string | null;
        expires_at: string | null;
        starts_at: string | null;
        updated_at: string | null;
        extra: string | null;
        reference: string | null;
        reference_hash: string | null;
      } | null;
      approved_account_ids: Record<string, number> | null;
    }>("nft.test.near", "nft_token", {
      token_id,
    });

    console.log({ token });

    return { token_id, score, token };
  });

  let nfts: Promise<{ token_id: string }[]> = new Promise((resolve) => {
    const nfts = Array.from({ length: 10 }, (_, i) => ({
      token_id: (i + 1).toString(),
    }));
    resolve(nfts);
  });
</script>

<div class="w-full">
  <div
    class="w-full flex items-center bg-gradient-to-r bg-gradient-from-emerald bg-gradient-to-lime w-full rounded-lg py-3 px-3 gap-6 mt-3"
  >
    {#await primaryNftTokenId}
      <!-- Skeleton of the below -->
      <div class="w-full flex justify-center items-center">
        <div class="i-svg-spinners:pulse-3 size-24" />
      </div>
    {:then token}
      <div class="flex flex-col justify-center items-start">
        <img
          class="size-24 rounded-3xl border-4 border-lime"
          src="https://bafybeifqejvrnlzraceyapuzne6d2cl2s5bolosrufpwp3lw22pqfcafo4.ipfs.nftstorage.link/{token.token_id}.png"
          alt="avatar"
        />
      </div>
      <div class="flex flex-col flex-1 justify-center items-start">
        <div class="font-bold text-lg text-black leading-tight">
          #{token.token_id}
        </div>
        <div class="font-light text-lg text-black leading-tight">
          {$accountId$}
        </div>
        <div class="font-bold text-lg text-black">
          {new FixedNumber(token.score, 24).format()}
        </div>
      </div>
      <button
        class="flex items-center justify-center bg-lime text-black font-bold rounded-lg px-4 py-2 border border-black"
      >
        Unstake
      </button>
    {/await}
  </div>

  <h2 class="text-2xl font-bold">Pick Your Primary NFT</h2>
  <ul class="not-prose flex w-full flex-wrap justify-evenly gap-4">
    {#await nfts}
      <p>Loading...</p>
    {:then nfts}
      {#each nfts as nft}
        <li
          class="flex items-center w-[30%] py-4 place-content-center cursor-pointer"
        >
          <div
            class="relative rounded-xl overflow-hidden border-2 border-transparent hover:border-lime"
          >
            <img
              class="size-24"
              src="https://bafybeifqejvrnlzraceyapuzne6d2cl2s5bolosrufpwp3lw22pqfcafo4.ipfs.nftstorage.link/{nft.token_id}.png"
              alt="avatar"
            />

            <!-- banner bottom center of the image to show token id -->
            <div
              class="absolute bottom-0 left-1/2 transform -translate-x-1/2 border-lime bg-lime-9/90 text-lime text-center w-full font-bold flex justify-center items-center"
            >
              <!-- <div class="i-mdi:check size-5 text-current" /> -->
              {nft.token_id}
            </div>
          </div>
        </li>
      {/each}
    {/await}
  </ul>
</div>
