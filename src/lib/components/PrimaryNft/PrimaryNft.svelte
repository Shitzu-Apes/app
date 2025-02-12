<script lang="ts">
  import type { Transaction } from "@near-wallet-selector/core";
  import { slide } from "svelte/transition";

  import Squircle from "../Squircle.svelte";

  import NftListItem from "./NftListItem.svelte";

  import { BuyNftBanner, Button } from "$lib/components";
  import { BottomSheetContent } from "$lib/layout/BottomSheet";
  import { Nft, nearWallet, type Token } from "$lib/near";
  import { primaryNftTokenId, refreshPrimaryNftOf } from "$lib/store";

  let selectedNftTokenId = "";

  const { accountId$ } = nearWallet;

  let nfts: Promise<Token[] | null> = new Promise((resolve) => resolve(null));

  function refreshNfts() {
    if ($accountId$) {
      nfts = Nft.nftTokensForOwner($accountId$);
    }
  }

  $: {
    if ($accountId$) {
      refreshNfts();
      refreshPrimaryNftOf($accountId$);
    }
  }

  async function stake() {
    const transactions: Omit<Transaction, "signerId">[] = [];
    if (await $primaryNftTokenId) {
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
    await nearWallet.signAndSendTransactions(
      { transactions },
      {
        onSuccess: () => {
          if ($accountId$) {
            refreshNfts();
            refreshPrimaryNftOf($accountId$);
          }
        },
        onFinally: () => {},
      },
    );
  }

  async function unstake() {
    await nearWallet.signAndSendTransaction(
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
            refreshPrimaryNftOf($accountId$);
          }
        },
        onFinally: () => {},
      },
    );
  }
</script>

<BottomSheetContent>
  <slot slot="header">
    <h1 class="text-xl text-lime mr-auto mx-3">Select Your Primary NFT</h1>
  </slot>
  <div class="w-full">
    <div
      class="relative w-full flex items-center bg-gradient-to-r bg-gradient-from-emerald bg-gradient-to-lime w-full rounded-b-lg py-3 px-3 gap-6"
    >
      {#await $primaryNftTokenId}
        <!-- Skeleton of the below -->
        <div class="w-full flex justify-center items-center">
          <div class="i-svg-spinners:pulse-3 size-24" />
        </div>
      {:then token}
        {#if token}
          <a
            href="/shitstars/{token.token_id}"
            class="flex flex-col justify-center items-start"
          >
            <Squircle
              class="size-24 text-lime flex-1"
              src="{import.meta.env.VITE_NFT_BASE_URL}/{token.token_id}.png"
            />
          </a>
          <div
            class="flex flex-col justify-center items-start text-sm md:text-lg flex-1 overflow-hidden"
          >
            <div class="font-bold text-black leading-tight">
              #{token.token_id}
            </div>
            <div class="font-light text-black leading-tight w-full truncate">
              {$accountId$}
            </div>
            <div class="font-bold text-black flex items-center">
              <div class="i-mdi:stars size-5 mr-1" />
              {token.score.format()}
            </div>
          </div>
          <Button
            type="custom"
            class="absolute bottom-3 right-3 flex items-center justify-center text-black border-b border-black font-bold text-xs mt-3 self-end ml-auto"
            onClick={unstake}
            spinnerColor="text-black"
          >
            Unstake
          </Button>
        {:else}
          <BuyNftBanner />
        {/if}
      {:catch}
        <BuyNftBanner />
      {/await}
    </div>

    {#await nfts}
      <div
        transition:slide
        class="flex items-center justify-center w-full h-24"
      >
        <div class="i-svg-spinners:6-dots-rotate text-size-12 text-lime" />
      </div>
    {:then nfts}
      <div transition:slide>
        {#if nfts && nfts.length > 0}
          <h2 class="text-2xl font-bold">Pick Your Primary NFT</h2>
          <ul class="not-prose flex w-full flex-wrap gap-4">
            {#each nfts as nft}
              <li
                class="flex items-center w-[30%] py-4 place-content-center cursor-pointer"
              >
                <NftListItem
                  on:click={() => (selectedNftTokenId = nft.token_id)}
                  isSelectedToken={nft.token_id === selectedNftTokenId}
                  tokenId={nft.token_id}
                />
              </li>
            {/each}
          </ul>
          <Button
            onClick={stake}
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
      </div>
    {/await}
  </div>
</BottomSheetContent>
