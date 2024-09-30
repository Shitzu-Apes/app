<script lang="ts">
  import { onDestroy, onMount } from "svelte";

  import { BottomSheetContent } from "$lib/layout/BottomSheet";
  import { closeBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";

  let countdownSecs: number | undefined;
  let timer: number | undefined;

  const launchTime = new Date("2024-09-30T15:00:00.000Z");

  onMount(() => {
    timer = setInterval(() => {
      countdownSecs = (launchTime.valueOf() - Date.now()) / 1_000;
    }, 100) as unknown as number;
  });
  onDestroy(() => {
    if (timer == null) return;
    clearInterval(timer);
  });
</script>

<BottomSheetContent variant="shitzu">
  <slot slot="header">
    <h2
      class="prose prose-invert prose-shitzu px-4 text-2xl font-bold text-shitzu-4"
    >
      Meme.Cooking mainnet
    </h2>
  </slot>
  <section class="text-white px-3 space-y-4 my-10">
    <div class="space-y-6 flex flex-col gap-2">
      {#if countdownSecs}
        <div class="mx-4 mb-4 font-bold text-[2rem] flex justify-center">
          {Math.trunc(countdownSecs / (60 * 60))
            .toString()
            .padStart(2, "00")}:{Math.trunc((countdownSecs % (60 * 60)) / 60)
            .toString()
            .padStart(2, "00")}:{Math.trunc(countdownSecs % 60)
            .toString()
            .padStart(2, "00")}
        </div>
      {/if}

      <div>
        Meme.Cooking will officially launch today at {launchTime.toLocaleTimeString()}
        (your local time). You are on the correct url, but the contract is still
        paused. Once the timer reaches zero, please refresh!
      </div>

      <div>
        In the meantime it could be worth setting up Telegram notifications via <a
          class="text-lightblue-3 hover:font-bold hover:underline"
          href="https://t.me/bettearbot?start=ref-28757995"
          target="_blank"
          rel="noopener noreferrer"
        >
          Bettear Bot</a
        >.
      </div>

      <div>
        Also please join our
        <a
          href="https://t.me/+wIFBaPQJmAcwYTc0"
          target="_blank"
          rel="noopener noreferrer"
          class="text-lightblue-3 hover:font-bold hover:underline"
        >
          Telegram</a
        >, give us a shoutout on
        <a
          href="https://x.com/memedotcooking"
          target="_blank"
          rel="noopener noreferrer"
          class="text-lightblue-3 hover:font-bold hover:underline"
        >
          𝕏</a
        >
        or read our
        <a
          href="https://docs.meme.cooking"
          target="_blank"
          rel="noopener noreferrer"
          class="text-lightblue-3 hover:font-bold hover:underline"
        >
          docs</a
        >.
      </div>

      <div>
        Meme.Cooking is built with ❤️ by <a
          href="https://shitzuapes.xyz"
          target="_blank"
          rel="noopener noreferrer"
          class="text-lightblue-3 hover:font-bold hover:underline">Shitzu</a
        >.
      </div>
    </div>
  </section>
  <button class="w-full text-white hover:font-bold" on:click={closeBottomSheet}>
    [Let me ape now please, sir]
  </button>
</BottomSheetContent>
