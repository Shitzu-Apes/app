<script lang="ts">
  import { bind } from "svelte-simple-modal";

  import { DexscreenerIcon } from "$lib/assets";
  import { Dexscreener, ShitzuSwap } from "$lib/components";
  import { ModalSize, modal$, modalSize$ } from "$lib/layout";
  import { memes } from "$lib/store";

  export async function showPriceChart() {
    modalSize$.set(ModalSize.Large);
    modal$.set(bind(Dexscreener, {}));
  }
</script>

<div class="flex flex-col gap-[1.2rem]">
  <ShitzuSwap />

  <button
    on:click={showPriceChart}
    class="border-2 border-lime hover:bg-lime/15 flex justify-center items-center decoration-none px-4 py-2 rounded-xl"
  >
    <DexscreenerIcon className="w-4 h-4 mr-2" />
    Show Price Chart
  </button>
  <div
    class="mt-2 bg-gradient-to-r bg-gradient-from-lime bg-gradient-to-emerald py-4 px-4 rounded-xl text-black flex flex-col not-prose"
  >
    <h2 class="text-base font-bold">EARN $DOGSHIT</h2>
    <div class="text-sm">
      By Staking with SHITZU Pool, Staker will earn
      <span class="font-bold"> $DOGSHIT </span>
      which could be redeemed for a bag of Meme token.
    </div>

    <div class="flex justify-between items-center mt-5">
      <ul class="flex">
        {#each memes as { name, src }}
          <li class="first:pl-2 -ml-2">
            <img {src} alt={name} class="w-9 h-9 rounded-full" />
          </li>
        {/each}
      </ul>
      <a
        href="/stake"
        class="bg-lime text-black font-bold text-sm rounded-lg px-5 py-2 flex items-center"
      >
        <div class="i-mdi-lightning-bolt w-6 h-6 -ml-2 mr-1" />
        Stake
      </a>
    </div>
  </div>
</div>
