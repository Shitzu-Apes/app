<script lang="ts">
  import { addToast } from "../../Toast.svelte";

  import Near from "$lib/assets/Near.svelte";
  import SHITZU_CHEF from "$lib/assets/static/agt.png";
  import SHITZU_BUTT from "$lib/assets/static/shitzu_butt.png";
  import McIcon from "$lib/components/MCIcon.svelte";
  import { BottomSheetContent } from "$lib/layout/BottomSheet";
  import { closeBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { Ft } from "$lib/near";
  import { sendNear } from "$lib/near/utils";
  import { FixedNumber } from "$lib/util";

  export let revenue: FixedNumber;
  export let meme: Meme;
  export let isWnear: boolean;

  let woofIntensity = 0;

  $: tipAmount = revenue
    .mul(new FixedNumber(BigInt(woofIntensity), 0))
    .div(new FixedNumber(BigInt(100), 0));

  async function handleTip() {
    const callback = {
      onSuccess: () => {
        addToast({
          data: {
            type: "simple",
            data: {
              title: "Woof-tastic!",
              description: `You've made ${woofIntensity} Shitzu${woofIntensity > 1 ? "s" : ""} very happy! 🐶`,
              color: "green",
            },
          },
        });
      },
    };

    const receiverId =
      import.meta.env.VITE_NETWORK_ID === "mainnet"
        ? "shitzu.sputnik-dao.near"
        : "marior.testnet";

    try {
      if (isWnear) {
        await Ft.ft_transfer_call(
          import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID,
          receiverId,
          tipAmount.toU128(),
          `Tip to ShitzuDAO for ${meme.name}`,
          callback,
        );
      } else {
        await sendNear(receiverId, tipAmount.toU128(), callback);
      }
      closeBottomSheet();
    } catch (error) {
      console.error("Error processing tip:", error);
      addToast({
        data: {
          type: "simple",
          data: {
            title: "Ruh-roh!",
            description:
              "The treat slipped out of our paws. Give it another go?",
            color: "red",
          },
        },
      });
    }
  }

  function increaseWoofIntensity() {
    woofIntensity = Math.min(woofIntensity + 1, 100);
  }

  function decreaseWoofIntensity() {
    woofIntensity = Math.max(woofIntensity - 1, 0);
  }
</script>

<BottomSheetContent variant="shitzu">
  <slot slot="header">
    <h2
      class="prose prose-invert prose-shitzu px-4 text-2xl font-bold text-shitzu-4"
    >
      Throw a Bone to Shitzu Woof!
    </h2>
  </slot>

  <section class="text-white px-4 space-y-6 my-6">
    <div class="flex items-center gap-4 bg-gray-800 p-4 rounded-lg">
      <McIcon {meme} class="w-16 h-16" />
      <div>
        <h3 class="text-xl">
          <span class="text-white">{meme.name}</span>
          <span class="text-shitzu-4">${meme.symbol}</span>
        </h3>
        <div class="flex items-center gap-2 mt-1">
          <Near className="w-5 h-5 bg-white text-black rounded-full" />
          <span class="font-medium">{revenue.format()} NEAR</span>
        </div>
      </div>
    </div>

    <div class="bg-gray-800 rounded-lg p-4 space-y-4">
      <div class="flex items-center gap-2">
        <div class="size-10 rounded-full bg-gray-700 overflow-hidden">
          <img
            src={SHITZU_CHEF}
            class="w-full h-full object-cover rounded-full scale-110"
            alt="Shitzu Chef"
          />
        </div>
        <div class="font-bold text-shitzu-4">ShitzuDAO</div>
      </div>

      <p class="text-sm">
        Your tip fills our treat jar, keeping Shitzu tails wagging and our
        platform's future bright!
      </p>
    </div>

    <button
      on:click={increaseWoofIntensity}
      class="animated animated-wobble animated-infinite mx-auto flex flex-col items-center gap-2 text-sm text-center py-2 px-4 rounded active:scale-95 active:bg-gray-500 transition-all duration-150"
    >
      <img
        src={SHITZU_BUTT}
        class="size-24 hover:scale-110 active:scale-90 transition-transform duration-150"
        alt="Shitzu Chef"
      />
      <span>Pet me! 🐶</span>
    </button>

    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-2">
        <button
          on:click={decreaseWoofIntensity}
          class="flex-none w-12 h-12 flex justify-center items-center text-2xl rounded bg-lime-400 hover:bg-lime-500 text-black transition-colors"
        >
          -
        </button>

        <button
          on:click={handleTip}
          class="flex-1 flex justify-center gap-2 items-center text-lg text-center py-3 px-4 rounded bg-lime-400 hover:bg-lime-500 text-black transition-colors"
        >
          Toss {tipAmount.format()}
          <Near className="w-5 h-5 bg-white text-black rounded-full" /> Treats
        </button>

        <button
          on:click={increaseWoofIntensity}
          class="flex-none w-12 h-12 flex justify-center items-center text-2xl rounded bg-lime-400 hover:bg-lime-500 text-black transition-colors"
        >
          +
        </button>
      </div>
    </div>
  </section>

  <button
    class="w-full text-shitzu-4 hover:font-bold mb-20"
    on:click={closeBottomSheet}
  >
    I'll Save My Treats for Later
  </button>
</BottomSheetContent>
