<script lang="ts">
  import { createEventDispatcher } from "svelte";

  import { addToast } from "../Toast.svelte";

  import { Button } from "$lib/components";
  import { nearWallet } from "$lib/near";

  export let checkpoint: number | null;
  export let claimable: number;

  const dispatch = createEventDispatcher();

  const INTERVAL = 18 * 60 * 60;
  const claimableDate = new Date(((checkpoint || 0) + INTERVAL) * 1000);

  let timeLeft: [number, number, number] | null = (() => {
    const now = new Date();
    const diff = claimableDate.getTime() - now.getTime();

    if (diff <= 0) {
      return null;
    }

    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);

    return [h, m, s];
  })();

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
    return nearWallet.signAndSendTransaction(
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
          addToast({
            data: {
              type: "simple",
              data: {
                title: "Shitstar Claim",
                description: `You successfully claimed and received ${claimable.toFixed(2)} Shitstars! - Participate in Ref Memeseason and come back tomorrow to claim more!`,
              },
            },
          });
        },
      },
    );
  }
</script>

<Button
  type="custom"
  class="relative w-full py-3 bg-dark text-lime rounded-lg mt-6 flex items-center justify-center disabled:bg-dark disabled:text-lime disabled:cursor-not-allowed disabled:opacity-50"
  onClick={timeLeft ? undefined : claim}
  disabled={!!timeLeft}
>
  <div class="flex items-center gap-1">
    {#if timeLeft}
      <div class="i-mdi:clock-outline size-5 ml-1" />
      {timeLeft[0]}h {timeLeft[1]}m {timeLeft[2]}s
    {:else}
      Claim
      <div class="i-mdi:stars size-5 ml-1" />
      {claimable.toFixed(2)}
    {/if}
  </div>
</Button>
