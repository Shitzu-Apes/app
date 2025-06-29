<script lang="ts">
  import { writable } from "svelte/store";

  // import ShitzuFace from "$lib/assets/logo/shitzu.webp";
  import { usePrimaryNftQuery } from "$lib/api/queries/rewarder";
  import Near from "$lib/assets/Near.svelte";
  import ConnectWallet from "$lib/auth/ConnectWallet.svelte";
  import { BuyNftBanner, PrimaryNft } from "$lib/components";
  import Faq from "$lib/components/Faq.svelte";
  import RefMemeSeason from "$lib/components/RefMemeSeason/RefMemeSeason.svelte";
  import Squircle from "$lib/components/Squircle.svelte";
  import { openBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
  import { Pool, nearWallet } from "$lib/near";
  import { FixedNumber } from "$lib/util";

  const { accountId$ } = nearWallet;

  // Use the primary NFT query hook
  $: primaryNftQuery = usePrimaryNftQuery($accountId$ || "");

  let stake$ = writable<FixedNumber | undefined>();

  $: fetchStake($accountId$);
  async function fetchStake(accountId?: string) {
    if (accountId == null) {
      $stake$ = undefined;
      return;
    }
    const account = await Pool.getAccount(accountId);
    stake$.set(new FixedNumber(account.staked_balance, 24));
  }

  $: accountData = [
    {
      title: "Shitstars",
      value: $primaryNftQuery.isLoading
        ? "Loading..."
        : $primaryNftQuery.isError
          ? "Error"
          : $primaryNftQuery.data
            ? new FixedNumber($primaryNftQuery.data[1] || "0", 18).format()
            : "None",
      icon: {
        type: "icon",
        cls: "i-mdi:stars",
      },
    },
    {
      title: "Primary NFT",
      value: $primaryNftQuery.isLoading
        ? "Loading..."
        : $primaryNftQuery.isError
          ? "Error"
          : $primaryNftQuery.data
            ? `#${$primaryNftQuery.data[0]}`
            : "None",
      icon: undefined,
    },
    {
      title: "Staked",
      value: $stake$
        ? $stake$.format({
            maximumFractionDigits: 4,
            maximumSignificantDigits: undefined,
          })
        : "None",
      icon: {
        type: "near",
      },
    },
  ];
</script>

{#if $accountId$}
  <div class="flex flex-col w-full relative">
    <button
      class="w-fit text-red hover:bg-red/10 px-3 py-2 rounded-full text-sm flex items-center justify-center gap-1 mt-2 self-end"
      on:click={() => nearWallet.signOut()}
    >
      <div class="i-mdi:logout size-4" />
      disconnect
    </button>
    <div
      class="flex flex-col gap-2 justify-center items-center rounded-xl p-2 w-full"
    >
      <button class="relative" on:click={() => openBottomSheet(PrimaryNft)}>
        <Squircle
          class="size-30 text-lime flex-1"
          src={$primaryNftQuery.data
            ? `${import.meta.env.VITE_NFT_BASE_URL}/${$primaryNftQuery.data[0]}.png`
            : ""}
        />
        <div class="absolute bottom-0 left-0 right-0 flex justify-center">
          <div class="bg-lime text-black text-xs px-1 py-0.5 rounded-full">
            <div class="flex items-center gap-1">
              <div class="i-mdi:pencil size-4" />
              Switch
            </div>
          </div>
        </div>
      </button>
      <h2 class="not-prose text-2xl font-bold">
        <div class="max-w-60 overflow-hidden text-ellipsis">
          {$accountId$}
        </div>
      </h2>
      {#if !$primaryNftQuery.data && !$primaryNftQuery.isLoading}
        <button class="relative" on:click={() => openBottomSheet(PrimaryNft)}>
          <div class="flex justify-center">
            <div class="bg-lime text-black text-sm px-2 py-1 rounded">
              <div class="flex items-center gap-1">
                <div class="i-mdi:pencil size-4" />
                Set Primary NFT
              </div>
            </div>
          </div>
        </button>
      {/if}
    </div>

    <ul class="w-full flex flex-wrap justify-between not-prose">
      {#each accountData as data}
        <li
          class="flex flex-col justify-center items-center min-w-[33%] border-r border-lime last:border-transparent"
        >
          <div
            class="flex items-center justify-center gap-1 font-bold f-text-8-16"
          >
            {#if data.icon}
              <div class="flex items-center f-w-10-20 f-h-10-20">
                {#if data.icon.type === "near"}
                  <Near className="w-full h-full" />
                {:else if data.icon.type === "icon"}
                  <div class="{data.icon.cls} w-full h-full" />
                {/if}
              </div>
            {/if}
            {data.value}
          </div>
          <div class="text-sm flex items-center gap-2 f-text-10-16">
            <div>{data.title}</div>
          </div>
        </li>
      {/each}
    </ul>
    <section>
      <h2>Rhea Finance</h2>
      <RefMemeSeason />

      <Faq
        qnas={[
          {
            question: "What happened to Ref/Rhea Finance Meme Season?",
            answer:
              "Rhea Finance Meme Season officially ended, so we will no longer emit Shitstar rewards for participation. You can unstake your Meme Season tokens.",
          },
          {
            question: "How are Shitstars calculated for LP staking?",
            answer:
              "For LP staking, everyone starts with a base of 100 Shitstars. You can earn up to 100 additional Shitstars, calculated as the minimum between 100 and the square root of your LP stake divided by 0.005.",
          },
        ]}
      />
    </section>
  </div>
{:else}
  <div
    class="min-h-[30vh] w-full flex flex-col justify-center items-center gap-10 py-6"
  >
    <ConnectWallet />
    <div
      class="relative w-full flex items-center bg-gradient-to-r bg-gradient-from-emerald bg-gradient-to-lime w-full rounded-lg py-3 px-3 gap-6"
    >
      <BuyNftBanner />
    </div>
  </div>
{/if}
