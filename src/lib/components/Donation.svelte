<script lang="ts">
  import { FixedNumber } from "@tarnadas/fixed-number";
  import { createEventDispatcher } from "svelte";

  import SHITZU from "$lib/assets/logo/shitzu.webp";
  import SHITZU_FACE from "$lib/assets/logo/shitzu_face.svg";
  import { wallet } from "$lib/near";
  import { refreshShitzuBalance, shitzuBalance } from "$lib/store";

  const SUGGESTED_AMOUNT = [1000, 5000, 10000, 20000, 50000, 100000];

  let donationAmount: number = SUGGESTED_AMOUNT[1];

  const dispatch = createEventDispatcher();

  const { accountId$ } = wallet;

  $: refreshShitzuBalance($accountId$);

  let error: string | null = null;

  async function donate() {
    const amount = new FixedNumber(BigInt(donationAmount * 1e18), 18);

    const balance = await $shitzuBalance;

    if (amount.toNumber() > balance.toNumber()) {
      error = "Insufficient balance";
      return;
    }

    wallet.signAndSendTransaction(
      {
        receiverId: "token.0xshitzu.near",
        actions: [
          {
            type: "FunctionCall",
            params: {
              methodName: "ft_transfer_call",
              args: {
                receiver_id: "rewards.0xshitzu.near",
                amount: amount.toU128(),
                msg: "Donation",
              },
              gas: 300_000_000_000_000n.toString(),
              deposit: "1",
            },
          },
        ],
      },
      {
        onSuccess: () => {
          dispatch("donation", { amount: donationAmount });
        },
        onFinally: () => {
          dispatch("donation", { amount: donationAmount });
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
          class="w-full bg-lime text-black rounded-lg p-3 flex justify-center items-center"
          class:opacity-50={donationAmount !== suggestedAmount}
          on:click={async () => {
            error = null;
            const balance = await $shitzuBalance;
            if (suggestedAmount > balance.toNumber()) {
              donationAmount = balance.toNumber();
            } else {
              donationAmount = suggestedAmount;
            }
          }}
        >
          <img src={SHITZU} class="size-6 mr-1" alt="Shitzu face" />
          {suggestedAmount.toLocaleString()}
        </button>
      </li>
    {/each}
  </ol>
  <input
    type="number"
    class="w-full mt-3 p-3 border border-black rounded-lg text-black appearance-none focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime focus:ring-opacity-50 bg-white"
    bind:value={donationAmount}
    on:input={async (e) => {
      error = null;

      // typeguard for e, e.target and e.target.value
      if (
        !(e instanceof InputEvent) ||
        !e.target ||
        "value" in e.target === false ||
        typeof e.target.value !== "string"
      ) {
        return;
      }

      const value = parseInt(e.target.value, 10);

      if (value < 0) {
        error = "Invalid amount";
        return;
      }

      const balance = await $shitzuBalance;

      if (value > balance.toNumber()) {
        donationAmount = balance.toNumber();
        return;
      }

      donationAmount = value;
    }}
  />
  <span class="text-xs my-3">
    {#if error}
      <span class="text-red-500">{error}</span>
    {:else}
      You are donating {(donationAmount || 0).toLocaleString()} SHITZU and will earn
      {((donationAmount || 0) * 4).toLocaleString()} Shitstars! Become the Shitstar
      - your contribution matters!
    {/if}
  </span>
  <button
    class="mt-3 w-full bg-gradient-to-r bg-gradient-from-lime bg-gradient-to-emerald text-black rounded-lg p-3 flex justify-center items-center gap-3 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
    on:click={() => {
      donate();
    }}
    disabled={error !== null}
  >
    <img src={SHITZU_FACE} class="size-6 mr-1" alt="Shitzu face" />
    Donate
  </button>
</div>

<style scoped>
  input::-webkit-outer-spin-button,
  input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  /* Firefox */
  input[type="number"] {
    -moz-appearance: textfield;
  }
</style>
