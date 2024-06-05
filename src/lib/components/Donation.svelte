<script lang="ts">
  import { FixedNumber } from "@tarnadas/fixed-number";
  import { createEventDispatcher } from "svelte";

  import SHITZU from "$lib/assets/logo/shitzu.webp";
  import SHITZU_FACE from "$lib/assets/logo/shitzu_face.svg";
  import { wallet } from "$lib/near";

  const SUGGESTED_AMOUNT = [1000, 5000, 10000, 20000, 50000, 100000];

  let donationAmount: number = SUGGESTED_AMOUNT[1];

  const dispatch = createEventDispatcher();

  async function donate() {
    const amount = new FixedNumber(BigInt(donationAmount * 1e18), 18).toU128();
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
                amount,
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

<div id="donation" class="mt-6">
  <h2>Donation</h2>
  <ol class="not-prose w-full flex flex-wrap items-center justify-evenly gap-5">
    {#each SUGGESTED_AMOUNT as suggestedAmount}
      <!-- Big button take 1/3 width -->
      <li class="w-[30%]">
        <button
          class="w-full bg-lime text-black rounded-lg p-3 flex justify-center items-center"
          class:opacity-50={donationAmount !== suggestedAmount}
          on:click={() => {
            donationAmount = suggestedAmount;
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
  />
  <span class="text-xs my-3">
    You are donating {(donationAmount || 0).toLocaleString()} SHITZU and will earn
    {((donationAmount || 0) * 4).toLocaleString()} Shitstars! Become the Shitstar
    - your contribution matters!
  </span>
  <button
    class="mt-3 w-full bg-gradient-to-r bg-gradient-from-lime bg-gradient-to-emerald text-black rounded-lg p-3 flex justify-center items-center gap-3 font-bold"
    on:click={() => {
      donate();
    }}
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
