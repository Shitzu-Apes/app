<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { writable } from "svelte/store";

  import Button from "./Button.svelte";
  import MessageBox from "./MessageBox.svelte";
  import { addToast } from "./Toast.svelte";
  import TokenInput from "./TokenInput.svelte";

  import { usePrimaryNftQuery } from "$lib/api/queries/rewarder";
  import { useShitzuBalanceQuery } from "$lib/api/queries/shitzuBalance";
  import SHITZU from "$lib/assets/logo/shitzu.webp";
  import SHITZU_FACE from "$lib/assets/logo/shitzu_face.svg";
  import { nearWallet } from "$lib/near";
  import { FixedNumber } from "$lib/util";

  const SUGGESTED_AMOUNT = [
    1_000n,
    5_000n,
    10_000n,
    20_000n,
    50_000n,
    100_000n,
  ].map((val) => new FixedNumber(val * 1_000_000_000_000_000_000n, 18));

  let input: TokenInput;
  let inputValue$ = writable<string | undefined>();
  $: input$ = input?.u128$;

  const dispatch = createEventDispatcher();

  const { accountId$ } = nearWallet;

  // Use the balance query
  $: shitzuBalanceQuery = useShitzuBalanceQuery($accountId$ || "");

  // Use the primary NFT query hook
  $: primaryNftQuery = usePrimaryNftQuery($accountId$ || "");

  $: if ($shitzuBalanceQuery.data) {
    updateDefaultInput($shitzuBalanceQuery.data);
  }

  function updateDefaultInput(shitzuBalance: FixedNumber) {
    if (shitzuBalance.valueOf() < SUGGESTED_AMOUNT[1].valueOf()) {
      $inputValue$ = shitzuBalance.toString();
    } else {
      $inputValue$ = SUGGESTED_AMOUNT[1].toString();
    }
  }

  let error: string | null = null;

  async function donate() {
    if ($input$ == null || !$shitzuBalanceQuery.data) return;

    const balance = $shitzuBalanceQuery.data;

    if ($input$.valueOf() > balance.valueOf()) {
      error = "Insufficient balance";
      return;
    }

    return nearWallet.signAndSendTransaction(
      {
        receiverId: "token.0xshitzu.near",
        actions: [
          {
            type: "FunctionCall",
            params: {
              methodName: "ft_transfer_call",
              args: {
                receiver_id: "rewards.0xshitzu.near",
                amount: $input$.toU128(),
                msg: "Donation",
              },
              gas: 50_000_000_000_000n.toString(),
              deposit: "1",
            },
          },
        ],
      },
      {
        onSuccess: () => {
          dispatch("donation", { amount: $input$ });
          $shitzuBalanceQuery.refetch();
          addToast({
            data: {
              type: "simple",
              data: {
                title: "Donation Success",
                description: `You successfully donated ${$input$!.format()} SHITZU and received ${$input$?.mul(new FixedNumber(4n)).format({ maximumFractionDigits: 2 })} Shitstars! - Donate more to climb up the leaderboard`,
              },
            },
          });
        },
      },
    );
  }
</script>

<div id="donation" class="mt-10 prose-lime prose prose-invert">
  <div class="flex justify-between items-center">
    <h2 class="mt-0">Donation</h2>
    {#if $shitzuBalanceQuery.isLoading}
      <div class="i-svg-spinners:pulse-3 size-4" />
    {:else if $shitzuBalanceQuery.isSuccess && $shitzuBalanceQuery.data}
      <div class="flex justify-center items-center">
        <img src={SHITZU} class="size-6 mr-1" alt="Shitzu face" />
        {$shitzuBalanceQuery.data.format()}
      </div>
    {/if}
  </div>
  <ol class="not-prose w-full flex flex-wrap items-center justify-evenly gap-5">
    {#each SUGGESTED_AMOUNT as suggestedAmount}
      <!-- Big button take 1/3 width -->
      <li class="w-[30%]">
        <button
          class="w-full text-black rounded-lg p-3 flex justify-center items-center border-2 border-transparent hover:border-lime {$input$?.valueOf() !==
          suggestedAmount.valueOf()
            ? 'bg-lime/50'
            : 'bg-lime'}"
          on:click={() => {
            error = null;
            if ($shitzuBalanceQuery.data) {
              if (
                suggestedAmount.valueOf() > $shitzuBalanceQuery.data.valueOf()
              ) {
                $inputValue$ = $shitzuBalanceQuery.data.toString();
              } else {
                $inputValue$ = suggestedAmount.toString();
              }
            }
          }}
        >
          <img src={SHITZU} class="size-6 mr-1" alt="Shitzu face" />
          {suggestedAmount.format({ maximumFractionDigits: 0 })}
        </button>
      </li>
    {/each}
  </ol>
  <TokenInput
    class="w-full mt-3 p-3 border border-lime rounded-lg text-lime appearance-none focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime focus:ring-opacity-50 bg-transparent text-center text-xl"
    bind:this={input}
    bind:value={$inputValue$}
    decimals={18}
    afterInputChange={() => {
      error = null;
    }}
  />
  <span class="text-xs my-3">
    {#if error}
      <span class="text-red-500">{error}</span>
    {:else if $primaryNftQuery.isLoading}
      <div class="i-svg-spinners:pulse-3 size-4 mt-2" />
    {:else if $primaryNftQuery.data}
      <span class="leading-tight inline-block mt-2">
        You are donating {$input$?.format() ?? "0"} SHITZU and SHITZU Revival #{$primaryNftQuery
          .data[0]}
        will earn
        {$input$?.mul(new FixedNumber(4n)).format() ?? "0"} Shitstars! Become the
        Shitstar - your contribution matters!
      </span>
    {:else}
      <div class="mt-2">
        <MessageBox type="warning">
          You haven't staked an NFT and won't earn any Shitstars - But your
          contribution still matters!
        </MessageBox>
      </div>
    {/if}
  </span>
  <Button
    type="custom"
    class="relative mt-3 w-full bg-gradient-to-r bg-gradient-from-lime bg-gradient-to-emerald text-black rounded-lg p-3 flex justify-center items-center gap-3 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
    spinnerColor="text-black"
    onClick={donate}
    disabled={error != null || $input$ == null || $input$.valueOf() === 0n}
  >
    <img src={SHITZU_FACE} class="size-6 mr-1" alt="Shitzu face" />
    Donate
  </Button>
</div>
