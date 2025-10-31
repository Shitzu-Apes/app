<script lang="ts">
  import { writable } from "svelte/store";
  import { slide } from "svelte/transition";

  import type { AccountId } from "$lib/abi";
  import Near from "$lib/assets/Near.svelte";
  import { ConnectWallet } from "$lib/auth";
  import { Faq, Stake, MessageBox, ValidatorStatistics } from "$lib/components";
  import { closeBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
  import {
    nearWallet,
    nearBalance,
    refreshNearBalance,
    type PoolFarm,
    Pool,
    RegularPool,
    Dogshit,
  } from "$lib/near";
  import { Rewarder } from "$lib/near/rewarder";
  import { FixedNumber } from "$lib/util";

  let selectedValidator: "meme" | "regular" = "meme";

  const stake$ = writable<FixedNumber | undefined>();
  const withdraw$ = writable<FixedNumber | undefined>();
  const regularStake$ = writable<FixedNumber | undefined>();
  const regularWithdraw$ = writable<FixedNumber | undefined>();

  let canWithdraw = false;
  let regularCanWithdraw = false;
  let totalStakers: number | null = null;
  let totalStaked: FixedNumber | null = null;
  let regularTotalStakers: number | null = null;
  let regularTotalStaked: FixedNumber | null = null;
  let regularAPY: number | null = null;
  let farm: PoolFarm | null = null;
  let undistributedRewards: [AccountId, string][] = [];

  let accountId$ = nearWallet.accountId$;

  $: hasStakedNft = $accountId$
    ? Rewarder.primaryNftOf($accountId$).then((nft) => nft != null)
    : Promise.resolve(false);

  $: fetchStake($accountId$);
  fetchTotalStake();
  fetchFarm();
  fetchRegularAPY();

  async function fetchStake(accountId?: string) {
    if (accountId == null) {
      $stake$ = undefined;
      $withdraw$ = undefined;
      $regularStake$ = undefined;
      $regularWithdraw$ = undefined;
      return;
    }

    const account = await Pool.getAccount(accountId);
    stake$.set(new FixedNumber(account.staked_balance, 24));
    withdraw$.set(new FixedNumber(account.unstaked_balance, 24));
    canWithdraw = account.can_withdraw;

    const regularAccount = await RegularPool.getAccount(accountId);
    regularStake$.set(new FixedNumber(regularAccount.staked_balance, 24));
    regularWithdraw$.set(new FixedNumber(regularAccount.unstaked_balance, 24));
    regularCanWithdraw = regularAccount.can_withdraw;
  }

  async function fetchTotalStake() {
    totalStaked = await Pool.getPoolSummary().then(
      (summary) => new FixedNumber(summary.total_staked_balance, 24),
    );
    totalStakers = await Pool.getNumberOfAccounts();

    regularTotalStaked = await RegularPool.getPoolSummary().then(
      (summary) => new FixedNumber(summary.total_staked_balance, 24),
    );
    regularTotalStakers = await RegularPool.getNumberOfAccounts();
  }

  async function fetchFarm() {
    undistributedRewards = await Dogshit.getUndistributedRewards();
    farm = await Pool.getFarm(0);
  }

  async function fetchRegularAPY() {
    try {
      regularAPY = await RegularPool.getAPY();
    } catch (error) {
      console.error("Failed to fetch regular validator APY:", error);
      regularAPY = null;
    }
  }

  let loading = false;
  async function withdraw() {
    loading = true;
    const contractId =
      selectedValidator === "meme"
        ? import.meta.env.VITE_VALIDATOR_CONTRACT_ID
        : import.meta.env.VITE_REGULAR_VALIDATOR_CONTRACT_ID;

    await nearWallet.signAndSendTransaction(
      {
        receiverId: contractId,
        actions: [
          {
            type: "FunctionCall",
            params: {
              methodName: "withdraw_all",
              args: {},
              gas: 60_000_000_000_000n.toString(),
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

  $: currentStake = selectedValidator === "meme" ? $stake$ : $regularStake$;
  $: currentWithdraw =
    selectedValidator === "meme" ? $withdraw$ : $regularWithdraw$;
  $: currentCanWithdraw =
    selectedValidator === "meme" ? canWithdraw : regularCanWithdraw;
  $: currentTotalStaked =
    selectedValidator === "meme" ? totalStaked : regularTotalStaked;
  $: currentTotalStakers =
    selectedValidator === "meme" ? totalStakers : regularTotalStakers;
</script>

<div class="w-full">
  <div class="text-center mb-6" class:pb-6={!$accountId$}>
    <h1 class="mb-0">Stake NEAR</h1>
    <div>
      {#if selectedValidator === "meme"}
        With SHITZU and receive $DOGSHIT
      {:else}
        With SHITZU Validator
      {/if}
    </div>
  </div>

  <!-- Validator Selection Toggle -->
  <div class="mb-6 flex justify-center">
    <div class="bg-black border-2 border-lime rounded-xl p-1 flex">
      <button
        class="px-4 py-2 rounded-lg font-bold transition-all duration-200"
        class:bg-lime={selectedValidator === "meme"}
        class:text-black={selectedValidator === "meme"}
        class:text-lime={selectedValidator !== "meme"}
        on:click={() => (selectedValidator = "meme")}
      >
        Meme Validator
      </button>
      <button
        class="px-4 py-2 rounded-lg font-bold transition-all duration-200"
        class:bg-lime={selectedValidator === "regular"}
        class:text-black={selectedValidator === "regular"}
        class:text-lime={selectedValidator !== "regular"}
        on:click={() => (selectedValidator = "regular")}
      >
        Regular Validator
      </button>
    </div>
  </div>

  {#if $accountId$}
    <div
      class="pb-12 border-2 border-lime rounded-t-xl px-3 pt-3 bg-gradient-to-r from-lime to-emerald text-black"
    >
      <div
        class="flex justify-between items-center pb-6 border-b border-black gap-5"
      >
        <div class="flex flex-col flex-shrink-0">
          <div class="flex items-center mb-3">
            <div class="whitespace-nowrap">
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

        <div
          class="border-2 px-3 py-1 border border-lime rounded-full flex-shrink-1 truncate"
        >
          <span>{$accountId$}</span>
        </div>
      </div>

      <div class="pt-6">
        <div class="flex flex-col">
          <div class="flex items-center mb-3">
            <div>Staked</div>
          </div>
          {#if currentStake}
            <span class="text-xl font-bold flex items-center gap-1">
              <Near className="size-6" />
              {currentStake.format()}
            </span>
          {:else}
            <span class="text-xl font-bold">-</span>
          {/if}
        </div>
      </div>
    </div>
  {/if}
  <div class="z-10 pb-6 border-2 border-lime rounded-xl px-3 pt-3 bg-black">
    {#if $accountId$ == null}
      <div class="flex flex-col gap-4">
        <ConnectWallet />
        <MessageBox>
          Please login in order to stake with Shitzu validator!
        </MessageBox>
      </div>
    {:else if $nearBalance != null && currentStake != null}
      <Stake
        walletConnected={$accountId$ != null}
        nearBalance={$nearBalance}
        stake={currentStake}
        validatorType={selectedValidator}
        afterUpdateBalances={() => {
          refreshNearBalance($accountId$);
          fetchStake($accountId$);
          fetchTotalStake();
          closeBottomSheet();
        }}
        on:claimSuccess={fetchFarm}
      ></Stake>
    {:else}
      <div class="w-full" transition:slide>
        <div class="i-svg-spinners:6-dots-rotate w-12 h-12 bg-gray-7 m-a" />
      </div>
    {/if}
    {#if currentWithdraw != null && currentWithdraw.valueOf() > 1_000}
      <div class="mt-6 pt-6 border-t border-lime" transition:slide>
        <div class="flex justify-between items-center">
          <div>
            <span class="flex flex-col mt-3">
              {#if currentCanWithdraw}
                Available to withdraw
              {:else}
                Pending unstake:
              {/if}
            </span>
            <span class="font-bold">{currentWithdraw.format()} NEAR</span>
          </div>

          <button
            class="px-2 py-2 text-black font-bold rounded-xl"
            on:click={withdraw}
            disabled={loading || !currentCanWithdraw}
            class:bg-coolgray={!currentCanWithdraw}
            class:bg-lime={currentCanWithdraw}
          >
            Withdraw
          </button>
        </div>
      </div>
    {/if}
  </div>

  {#if selectedValidator === "meme"}
    {#await hasStakedNft then hasStakedNft}
      <ValidatorStatistics
        {farm}
        {undistributedRewards}
        totalStaked={currentTotalStaked}
        totalStakers={currentTotalStakers}
        {hasStakedNft}
        validatorType="meme"
      />
    {/await}
  {:else}
    <ValidatorStatistics
      farm={null}
      undistributedRewards={[]}
      totalStaked={currentTotalStaked}
      totalStakers={currentTotalStakers}
      hasStakedNft={false}
      validatorType="regular"
      apy={regularAPY}
    />
  {/if}

  <Faq
    qnas={selectedValidator === "meme"
      ? [
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
            question:
              "What do I receive when I stake with the SHITZU validator?",
            answer:
              "When you stake with the SHITZU validator, you receive a token called $DOGSHIT. This token wraps all the underlying meme tokens emitted by the staking pool.",
          },
          {
            question: "What benefits do I have as an NFT staker?",
            answer:
              "As an NFT staker you receive a 25% boost on all $DOGSHIT claims. The APRs will automatically display the correct APR based on your connected wallet.",
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
        ]
      : [
          {
            question: "What is the SHITZU regular validator?",
            answer:
              "The SHITZU regular validator is a standard NEAR validator with a 5% staking fee. It provides reliable staking rewards without meme token emissions.",
          },
          {
            question:
              "How does the regular validator differ from the meme validator?",
            answer:
              "The regular validator has a 5% fee (vs 25% for meme validator) and doesn't emit meme tokens. You receive standard NEAR staking rewards only.",
          },
          {
            question: "What rewards do I get from the regular validator?",
            answer:
              "You receive standard NEAR staking rewards based on the network's base APR, minus the 5% validator fee. No meme tokens or $DOGSHIT are distributed.",
          },
          {
            question: "Can I use NFT boosts with the regular validator?",
            answer:
              "No, NFT boosts and $DOGSHIT rewards are only available with the meme validator. The regular validator provides standard staking rewards only.",
          },
        ]}
  />
</div>
