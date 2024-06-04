<script lang="ts">
  import { FixedNumber } from "@tarnadas/fixed-number";
  import { writable } from "svelte/store";

  import NftBanner from "$lib/components/NFTBanner.svelte";
  // import { wallet } from "$lib/near";
  import { view } from "$lib/near/utils";

  let selectedNftTokenId = "";

  type Token = {
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
  };

  // const { accountId$ } = wallet;
  const accountId$ = writable<string>("lucy_hane.test.near");

  let primaryNftTokenId = view<[string, string]>(
    "rewarder.test.near",
    "primary_nft_of",
    {
      account_id: $accountId$,
    },
  ).then(async ([token_id, score]) => {
    const token = await view<Token>("nft.test.near", "nft_token", {
      token_id,
    });

    return { token_id, score, token };
  });

  let nfts: Promise<{ token_id: string }[]> = view<Token[]>(
    "nft.test.near",
    "nft_tokens_for_owner",
    {
      account_id: $accountId$,
    },
  );
</script>

<div class="w-full">
  <div
    class="relative w-full flex items-center bg-gradient-to-r bg-gradient-from-emerald bg-gradient-to-lime w-full rounded-lg py-3 px-3 gap-6 mt-3"
  >
    {#await primaryNftTokenId}
      <!-- Skeleton of the below -->
      <div class="w-full flex justify-center items-center">
        <div class="i-svg-spinners:pulse-3 size-24" />
      </div>
    {:then token}
      <div class="flex flex-col justify-center items-start">
        <img
          class="size-24 rounded-3xl border-4 border-lime flex-1"
          src="https://bafybeifqejvrnlzraceyapuzne6d2cl2s5bolosrufpwp3lw22pqfcafo4.ipfs.nftstorage.link/{token.token_id}.png"
          alt="avatar"
        />
      </div>
      <div
        class="flex flex-col justify-center items-start text-sm md:text-lg flex-1"
      >
        <div class="font-bold text-black leading-tight">
          #{token.token_id}
        </div>
        <div class="font-light text-black leading-tight">
          {$accountId$}
        </div>
        <div class="font-bold text-black">
          {new FixedNumber(token.score, 18).format()}
        </div>
      </div>
      <button
        class="absolute bottom-3 right-3 flex items-center justify-center text-black border-b border-black font-bold text-xs mt-3 self-end ml-auto"
      >
        Unstake
      </button>
    {:catch}
      <NftBanner />
    {/await}
  </div>

  {#await nfts}
    <p>Loading...</p>
  {:then nfts}
    {#if nfts.length > 0}
      <h2 class="text-2xl font-bold">Pick Your Primary NFT</h2>
      <ul class="not-prose flex w-full flex-wrap gap-4">
        {#each nfts as nft}
          <li
            class="flex items-center w-[30%] py-4 place-content-center cursor-pointer"
          >
            <button
              class="relative rounded-xl overflow-hidden border-2 border-transparent hover:border-lime"
              class:border-lime={selectedNftTokenId === nft.token_id}
              on:click={() => (selectedNftTokenId = nft.token_id)}
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
                {#if selectedNftTokenId === nft.token_id}
                  <div class="i-mdi:check size-5 text-current" />
                {/if}
                {nft.token_id}
              </div>
            </button>
          </li>
        {/each}
      </ul>
      <button
        class="w-full bg-gradient-to-r bg-lime text-black font-bold rounded-lg py-3 px-3 mt-3"
      >
        Set {selectedNftTokenId} as Primary NFT
      </button>
    {/if}
  {/await}
</div>
