<script lang="ts">
  export let checkpoint: number | null;
  export let claimable: number;

  const DAY = 24 * 60 * 60 * 1_000;
  $: claimableDate = new Date(checkpoint || 0 + DAY);

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
</script>

<button
  class="w-full py-3 bg-dark text-lime rounded-lg mt-6 flex items-center justify-center"
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
