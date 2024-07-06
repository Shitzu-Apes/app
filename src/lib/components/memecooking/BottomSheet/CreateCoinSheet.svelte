<script lang="ts">
  // export let name,
  //   ticker,
  //   description,
  //   image,
  //   icon,
  //   twitterLink,
  //   telegramLink,
  //   website,
  //   durationMs,
  //   totalSupply,
  //   storageCost;

  import { onMount } from "svelte";
  import { slide } from "svelte/transition";

  import { BottomSheetContent } from "$lib/layout/BottomSheet";

  let status: "Uploading Meme" | "Preparing the Ingredient" | "Cooking" =
    "Uploading Meme";

  export let uploadPromise: Promise<{
    imageCID: string;
    referenceCID: string;
    referenceHash: string;
  }>;

  export let createTransactionPromise: (args: {
    imageCID: string;
    referenceCID: string;
    referenceHash: string;
  }) => Promise<void>;

  onMount(async () => {
    const { imageCID, referenceCID, referenceHash } = await uploadPromise;

    console.log("[CreateCoinSheet] referenceCID", referenceCID);

    status = "Preparing the Ingredient";

    await createTransactionPromise({ referenceCID, referenceHash, imageCID });

    status = "Cooking";
  });
</script>

<BottomSheetContent variant="shitzu">
  <slot slot="header">
    <div class="flex items-center justify-between w-full px-2">
      <h2 class="text-lg font-bold text-white">{status}</h2>
    </div>
  </slot>

  <div
    class="flex flex-col items-center h-full w-full justify-center text-white"
  >
    {#if status === "Uploading Meme"}
      <div
        transition:slide
        class="w-full h-full flex flex-col justify-center items-center gap-10"
      >
        <div class="i-svg-spinners:180-ring size-20" />
        <h1 class="text-xl">Uploading Meme...</h1>
      </div>
    {:else if status === "Preparing the Ingredient"}
      <div
        transition:slide
        class="w-full h-full flex flex-col justify-center items-center gap-10"
      >
        <div class="i-svg-spinners:180-ring size-20" />
        <h1 class="text-xl">Is it ready, Chef?</h1>
      </div>
    {:else if status === "Cooking"}
      <div
        transition:slide
        class="w-full h-full flex flex-col justify-center items-center gap-10 text-shitzu-4"
      >
        <div class="i-line-md:confirm-circle size-20 bg-shitzu-4" />
        <h1 class="text-xl">Cooking</h1>
      </div>
    {/if}
  </div>
</BottomSheetContent>
