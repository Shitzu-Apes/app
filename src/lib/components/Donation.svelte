<script lang="ts">
  import { FixedNumber } from "@tarnadas/fixed-number";
  import { createEventDispatcher } from "svelte";
  import { writable } from "svelte/store";

  import Button from "./Button.svelte";
  import TokenInput from "./TokenInput.svelte";

  import SHITZU from "$lib/assets/logo/shitzu.webp";
  import SHITZU_FACE from "$lib/assets/logo/shitzu_face.svg";
  import { wallet } from "$lib/near";
  import { showSnackbar } from "$lib/snackbar";
  import { refreshShitzuBalance, shitzuBalance } from "$lib/store";

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

  const { accountId$ } = wallet;

  $: refreshShitzuBalance($accountId$);

  $: if ($shitzuBalance) {
    updateDefaultInput($shitzuBalance);
  }

  async function updateDefaultInput(bal: Promise<FixedNumber>) {
    const shitzuBalance = await bal;
    if (shitzuBalance.valueOf() < SUGGESTED_AMOUNT[1].valueOf()) {
      $inputValue$ = shitzuBalance.toString();
    } else {
      $inputValue$ = SUGGESTED_AMOUNT[1].toString();
    }
  }

  let error: string | null = null;

  async function donate() {
    if ($input$ == null) return;

    const balance = await $shitzuBalance;

    if ($input$.valueOf() > balance.valueOf()) {
      error = "Insufficient balance";
      return;
    }

    return wallet.signAndSendTransaction(
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
          refreshShitzuBalance($accountId$);
          showSnackbar(
            `You successfully donated ${$input$!.format()} SHITZU and received ${$input$?.mul(new FixedNumber(4n)).format({ maximumFractionDigits: 2 })} Shitstars! - Donate more to climb up the leaderboard`,
          );
        },
      },
    );
  }
</script>

<div id="donation" class="mt-10">
  <div class="flex justify-between items-center">
    <h2 class="mt-0">Donation</h2>
    {#await $shitzuBalance}
      <div class="i-svg-spinners:pulse-3 size-4" />
    {:then balance}
      <div class="flex justify-center items-center">
        <img src={SHITZU} class="size-6 mr-1" alt="Shitzu face" />
        {balance.format()}
      </div>
    {/await}
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
          on:click={async () => {
            error = null;
            const balance = await $shitzuBalance;
            if (suggestedAmount.valueOf() > balance.valueOf()) {
              $inputValue$ = balance.toString();
            } else {
              $inputValue$ = suggestedAmount.toString();
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
    class="w-full mt-3 p-3 border border-black rounded-lg text-black appearance-none focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime focus:ring-opacity-50 bg-white"
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
    {:else}
      You are donating {$input$?.format() ?? "0"} SHITZU and will earn
      {$input$?.mul(new FixedNumber(4n)).format() ?? "0"} Shitstars! Become the Shitstar
      - your contribution matters!
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
