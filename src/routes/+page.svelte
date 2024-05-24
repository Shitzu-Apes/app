<script lang="ts">
  import { bind } from "svelte-simple-modal";

  import { DexscreenerIcon } from "$lib/assets";
  import { Dexscreener } from "$lib/components";
  import { ModalSize, modal$, modalSize$ } from "$lib/layout";
  import ShitzuSwap from "$lib/components/ShitzuSwap.svelte";

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
  <div class="mt-2 text-balance">
    Shitzu community is running a 50% fee validator with a staking farm that
    emits various meme tokens from the Near ecosystem. These meme tokens
    subsidize the staking fee. Due to the price fluctuations of the meme tokens
    this can result in much higher APRs. If you stake with our validator you
    will receive a token called $DOGSHIT, which wraps all underlying meme
    tokens. $DOGSHIT has no other purpose than being burnt to receive the
    underlying tokens.
  </div>
</div>
