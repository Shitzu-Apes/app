<script lang="ts">
  import type { HereCall } from "@here-wallet/core";
  import { FixedNumber } from "@tarnadas/fixed-number";

  import { BuyNftBanner, Button } from "$lib/components";
  import { Nft, wallet, type Token } from "$lib/near";
  import { Rewarder } from "$lib/near/rewarder";

  let selectedNftTokenId = "";

  const { accountId$ } = wallet;

  let primaryNftTokenId: Promise<{
    token_id: string;
    score: FixedNumber;
    token: Token;
  } | null> = new Promise((resolve) => resolve(null));
  function refreshPrimaryNftOf() {
    if ($accountId$) {
      primaryNftTokenId = Rewarder.primaryNftOf($accountId$).then(
        async (somePrimaryNftTokenId) => {
          if (!somePrimaryNftTokenId) {
            return null;
          }

          const [token_id, score] = somePrimaryNftTokenId;
          const token = await Nft.nftToken(token_id);

          return { token_id, score: new FixedNumber(score, 18), token };
        },
      );
    }
  }

  let nfts: Promise<Token[] | null> = new Promise((resolve) => resolve(null));

  function refreshNfts() {
    if ($accountId$) {
      nfts = Nft.nftTokensForOwner($accountId$);
    }
  }

  $: {
    if ($accountId$) {
      refreshNfts();
      refreshPrimaryNftOf();
    }
  }

  async function stake() {
    const transactions: HereCall[] = [];
    if (await primaryNftTokenId) {
      transactions.push({
        receiverId: import.meta.env.VITE_REWARDER_CONTRACT_ID,
        actions: [
          {
            type: "FunctionCall",
            params: {
              methodName: "unstake",
              args: {},
              gas: 30_000_000_000_000n.toString(),
              deposit: "0",
            },
          },
        ],
      });
    }
    transactions.push({
      receiverId: import.meta.env.VITE_NFT_CONTRACT_ID,
      actions: [
        {
          type: "FunctionCall",
          params: {
            methodName: "nft_transfer_call",
            args: {
              receiver_id: import.meta.env.VITE_REWARDER_CONTRACT_ID,
              token_id: selectedNftTokenId,
              msg: "",
            },
            gas: 50_000_000_000_000n.toString(),
            deposit: "1",
          },
        },
      ],
    });
    await wallet.signAndSendTransactions(
      { transactions },
      {
        onSuccess: () => {
          if ($accountId$) {
            refreshNfts();
            refreshPrimaryNftOf();
          }
        },
        onFinally: () => {},
      },
    );
  }

  async function unstake() {
    await wallet.signAndSendTransaction(
      {
        receiverId: import.meta.env.VITE_REWARDER_CONTRACT_ID,
        actions: [
          {
            type: "FunctionCall",
            params: {
              methodName: "unstake",
              args: {},
              gas: 30_000_000_000_000n.toString(),
              deposit: "0",
            },
          },
        ],
      },
      {
        onSuccess: () => {
          if ($accountId$) {
            refreshNfts();
            refreshPrimaryNftOf();
          }
        },
        onFinally: () => {},
      },
    );
  }
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
      {#if token}
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
            {token.score.format()}
          </div>
        </div>
        <button
          class="absolute bottom-3 right-3 flex items-center justify-center text-black border-b border-black font-bold text-xs mt-3 self-end ml-auto"
          on:click={unstake}
        >
          Unstake
        </button>
      {:else}
        <BuyNftBanner />
      {/if}
    {:catch}
      <BuyNftBanner />
    {/await}
  </div>

  {#await nfts}
    <p>Loading...</p>
  {:then nfts}
    {#if nfts && nfts.length > 0}
      <h2 class="text-2xl font-bold">Pick Your Primary NFT</h2>
      <ul class="not-prose flex w-full flex-wrap gap-4">
        {#each nfts as nft}
          <li
            class="flex items-center w-[30%] py-4 place-content-center cursor-pointer"
          >
            <button
              class="relative rounded-xl overflow-hidden border-2 hover:border-lime"
              class:border-transparent={selectedNftTokenId !== nft.token_id}
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
      <Button
        on:click={stake}
        disabled={!selectedNftTokenId}
        class="w-full py-3 mt-3"
      >
        {#if selectedNftTokenId}
          Set {selectedNftTokenId} as Primary NFT
        {:else}
          Please select a new primary NFT
        {/if}
      </Button>
    {/if}
  {/await}
</div>
