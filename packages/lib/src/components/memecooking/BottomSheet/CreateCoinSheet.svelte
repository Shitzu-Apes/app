<script lang="ts">
  import { onMount } from "svelte";
  import { slide } from "svelte/transition";

  import { Button } from "$lib/components";
  import { BottomSheetContent } from "$lib/layout/BottomSheet";
  import { closeBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";

  let status:
    | "Uploading Meme"
    | "Preparing the Ingredient"
    | "Cooking"
    | "Error" = "Uploading Meme";

  let imageCID: string;
  let referenceCID: string;
  let referenceHash: string;

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
    try {
      const res = await uploadPromise;
      imageCID = res.imageCID;
      referenceCID = res.referenceCID;
      referenceHash = res.referenceHash;

      console.log("[CreateCoinSheet] referenceCID", referenceCID);
      status = "Preparing the Ingredient";
    } catch (err) {
      console.error(err);
      status = "Error";
      setTimeout(() => {
        closeBottomSheet();
      }, 5_000);
      return;
    }
  });

  function sendTransaction() {
    return createTransactionPromise({ referenceCID, referenceHash, imageCID })
      .then(() => {
        status = "Cooking";
      })
      .catch((err) => {
        console.error(err);
        status = "Error";
        setTimeout(() => {
          closeBottomSheet();
        }, 5_000);
      });
  }
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
        <h1 class="text-xl">Ready to cook!</h1>
        <Button
          type="custom"
          onClick={sendTransaction}
          class="mx-a px-6 py-2 bg-shitzu-4 hover:bg-shitzu-4/85 text-white rounded flex justify-center items-center"
          >Start Cooking</Button
        >
      </div>
    {:else if status === "Cooking"}
      <div
        transition:slide
        class="w-full h-full flex flex-col justify-center items-center gap-10 text-shitzu-4"
      >
        <div class="i-line-md:confirm-circle size-20 bg-shitzu-4" />
        <h1 class="text-xl">Cooking</h1>
      </div>
    {:else if status === "Error"}
      <div
        transition:slide
        class="w-full h-full flex flex-col justify-center items-center gap-10 text-red-4"
      >
        <div class="i-line-md:close-circle size-20 bg-red-4" />
        <h1 class="text-xl">Something went wrong. Please retry...</h1>
      </div>
    {/if}
  </div>
</BottomSheetContent>
