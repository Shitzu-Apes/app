<script lang="ts">
  import { writable } from "svelte/store";
  import { slide } from "svelte/transition";

  import type { AccountId } from "$lib/abi";
  import Near from "$lib/assets/Near.svelte";
  import { ConnectWallet } from "$lib/auth";
  import { Faq, Stake, MessageBox, ValidatorStatistics } from "$lib/components";
  import { modal$ } from "$lib/layout";
  import {
    wallet,
    nearBalance,
    refreshNearBalance,
    type PoolFarm,
    Pool,
    Dogshit,
  } from "$lib/near";
  import { Rewarder } from "$lib/near/rewarder";
  import { FixedNumber } from "$lib/util";

  const stake$ = writable<FixedNumber | undefined>();
  const withdraw$ = writable<FixedNumber | undefined>();
  let canWithdraw = false;
  let totalStakers: number | null = null;
  let totalStaked: FixedNumber | null = null;
  let farm: PoolFarm | null = null;
  let undistributedRewards: [AccountId, string][] = [];

  let accountId$ = wallet.accountId$;

  $: hasStakedNft = $accountId$
    ? Rewarder.primaryNftOf($accountId$).then((nft) => nft != null)
    : Promise.resolve(false);

  $: refreshNearBalance($accountId$);
  $: fetchStake($accountId$);
  fetchTotalStake();
  fetchFarm();

  async function fetchStake(accountId?: string) {
    if (accountId == null) {
      $stake$ = undefined;
      $withdraw$ = undefined;
      return;
    }
    const account = await Pool.getAccount(accountId);
    stake$.set(new FixedNumber(account.staked_balance, 24));
    withdraw$.set(new FixedNumber(account.unstaked_balance, 24));
    canWithdraw = account.can_withdraw;
  }

  async function fetchTotalStake() {
    totalStaked = await Pool.getPoolSummary().then(
      (summary) => new FixedNumber(summary.total_staked_balance, 24),
    );
    totalStakers = await Pool.getNumberOfAccounts();
  }

  async function fetchFarm() {
    undistributedRewards = await Dogshit.getUndistributedRewards();
    farm = await Pool.getFarm(0);
  }

  let loading = false;
  async function withdraw() {
    loading = true;
    await wallet.signAndSendTransaction(
      {
        receiverId: import.meta.env.VITE_VALIDATOR_CONTRACT_ID,
        actions: [
          {
            type: "FunctionCall",
            params: {
              methodName: "withdraw_all",
              args: {},
              gas: 30_000_000_000_000n.toString(),
              deposit: "0",
            },
          },
        ],
      },
      {
        onSuccess: () => {
          refreshNearBalance($accountId$);
          fetchStake($accountId$);
          fetchTotalStake();
        },
        onFinally: () => {
          loading = false;
        },
      },
    );
  }
</script>

<div class="w-full">
  <div class="text-center mb-6" class:pb-6={!$accountId$}>
    <h1 class="mb-0">Stake NEAR</h1>
    <div>With SHITZU and receive $DOGSHIT</div>
  </div>

  {#if $accountId$}
    <div
      class="pb-12 border-2 border-lime rounded-t-xl px-3 pt-3 bg-gradient-to-r from-lime to-emerald text-black"
    >
      <div class="flex justify-between items-center pb-6 border-b border-black">
        <div class="flex flex-col">
          <div class="flex items-center mb-3">
            <div>
              {#if $nearBalance != null && $nearBalance.toNumber() < 0.5}
                Balance too low
              {:else}
                Available to stake
              {/if}
            </div>
            <div
              class="w-3 h-3 rounded-full bg-cyan ml-2"
              class:bg-red={$nearBalance != null &&
                $nearBalance.toNumber() < 0.5}
            />
          </div>
          {#if $nearBalance}
            <span class="text-xl font-bold flex items-center gap-1">
              <Near className="size-6" />
              {$nearBalance.format()}
            </span>
          {:else}
            <span class="text-xl font-bold">-</span>
          {/if}
        </div>

        <div class="border-2 px-3 py-1 border border-lime rounded-full">
          <span>{$accountId$}</span>
        </div>
      </div>

      <div class="pt-6">
        <div class="flex flex-col">
          <div class="flex items-center mb-3">
            <div>Staked</div>
          </div>
          {#if $stake$}
            <span class="text-xl font-bold flex items-center gap-1">
              <Near className="size-6" />
              {$stake$.format()}
            </span>
          {:else}
            <span class="text-xl font-bold">-</span>
          {/if}
        </div>
      </div>
    </div>
  {/if}
  <div
    class="-mt-6 z-10 pb-6 border-2 border-lime rounded-xl px-3 pt-3 bg-black"
  >
    {#if $accountId$ == null}
      <ConnectWallet />
      <MessageBox>
        Please login in order to stake with Shitzu validator!
      </MessageBox>
    {:else if $nearBalance != null && $stake$ != null}
      <Stake
        walletConnected={$accountId$ != null}
        nearBalance={$nearBalance}
        stake={$stake$}
        afterUpdateBalances={() => {
          refreshNearBalance($accountId$);
          fetchStake($accountId$);
          fetchTotalStake();
          $modal$ = null;
        }}
      ></Stake>
    {:else}
      <div class="w-full" transition:slide>
        <div class="i-svg-spinners:6-dots-rotate w-12 h-12 bg-gray-7 m-a" />
      </div>
    {/if}
    {#if $withdraw$ != null && $withdraw$.valueOf() > 1_000}
      <div class="mt-6 pt-6 border-t border-lime" transition:slide>
        <div class="flex justify-between items-center">
          <div>
            <span class="flex flex-col mt-3">
              {#if canWithdraw}
                Available to withdraw
              {:else}
                Pending unstake:
              {/if}
            </span>
            <span class="font-bold">{$withdraw$.format()} NEAR</span>
          </div>

          <button
            class="px-2 py-2 text-black font-bold rounded-xl"
            on:click={withdraw}
            disabled={loading || !canWithdraw}
            class:bg-coolgray={!canWithdraw}
            class:bg-lime={canWithdraw}
          >
            Withdraw
          </button>
        </div>
      </div>
    {/if}
  </div>

  {#await hasStakedNft then hasStakedNft}
    <ValidatorStatistics
      {farm}
      {undistributedRewards}
      {totalStaked}
      {totalStakers}
      {hasStakedNft}
    />
  {/await}

  <Faq
    qnas={[
      {
        question: "What is the SHITZU community's staking pool?",
        answer:
          "The SHITZU community runs a validator with a 25% staking fee. This staking pool emits various meme tokens from the NEAR ecosystem, which help subsidize the staking fee.",
      },
      {
        question: "How does the staking fee subsidy work?",
        answer:
          "The staking fee is subsidized by emitting various meme tokens from the NEAR ecosystem. These meme tokens can fluctuate in price, resulting in potentially higher Annual Percentage Rates (APRs) for stakers.",
      },
      {
        question: "What do I receive when I stake with the SHITZU validator?",
        answer:
          "When you stake with the SHITZU validator, you receive a token called $DOGSHIT. This token wraps all the underlying meme tokens emitted by the staking pool.",
      },
      {
        question: "What benefits do I have as an NFT holder?",
        answer:
          "As an NFT holder you receive a 25% boost on all $DOGSHIT claims. The APRs will automatically display the correct APR based on your connected wallet.",
      },
      {
        question: "What is the purpose of the $DOGSHIT token?",
        answer:
          "$DOGSHIT has no other purpose than being burnt to receive the underlying meme tokens. You can burn $DOGSHIT to redeem the meme tokens it represents.",
      },
      {
        question: "How do meme token price fluctuations affect staking?",
        answer:
          "Due to the price fluctuations of the meme tokens emitted by the staking pool, the Annual Percentage Rates (APRs) can be much higher, offering potentially greater rewards for stakers.",
      },
    ]}
  />
</div>
