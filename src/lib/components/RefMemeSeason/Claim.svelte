<script lang="ts">
  import { createEventDispatcher } from "svelte";

  import { wallet } from "$lib/near";
  import { showSnackbar } from "$lib/snackbar";

  export let checkpoint: number | null;
  export let claimable: number;

  const dispatch = createEventDispatcher();

  const DAY = 24 * 60 * 60 * 1_000;
  $: claimableDate = new Date(((checkpoint || 0) + DAY) * 1000);

  let timeLeft: [number, number, number] | null = null;
  $: {
    const interval = setInterval(() => {
      const now = new Date();
      const diff = claimableDate.getTime() - now.getTime();
      if (diff <= 0) {
        timeLeft = null;
        clearInterval(interval);
        return;
      }

      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      timeLeft = [h, m, s];
    }, 1000);
  }

  async function claim() {
    return wallet.signAndSendTransaction(
      {
        receiverId: "memeseason.0xshitzu.near",
        actions: [
          {
            type: "FunctionCall",
            params: {
              methodName: "claim_ref_memeseason",
              args: {},
              gas: 50_000_000_000_000n.toString(),
              deposit: "0",
            },
          },
        ],
      },
      {
        onSuccess: () => {
          dispatch("claimed", {});
          showSnackbar(
            `You successfully claimed and received ${claimable.toFixed(2)} Shitstars! - Participate in Ref Memeseason and come back tomorrow to claim more!`,
          );
        },
      },
    );
  }
</script>

<button
  class="w-full py-3 bg-dark text-lime rounded-lg mt-6 flex items-center justify-center disabled:bg-dark disabled:text-lime disabled:cursor-not-allowed disabled:opacity-50"
  on:click={timeLeft ? undefined : claim}
  disabled={!!timeLeft}
>
  {#if timeLeft}
    Shitstars available in {timeLeft[0]}h {timeLeft[1]}m {timeLeft[2]}s
  {:else}
    <div class="flex items-center gap-1">
      Claim
      <div class="i-mdi:stars size-5 ml-1" />
      {claimable.toFixed(2)}
    </div>
  {/if}
</button>
