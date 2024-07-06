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

  import { BottomSheetContent } from "$lib/layout/BottomSheet";

  let status: "ipfs-uploading" | "creating" | "success" = "ipfs-uploading";

  export let uploadPromise: Promise<{
    imageCID: string;
    referenceCID: string;
    referenceHash: string;
  }>;

  export let createTransactionPromise: (args: {
    referenceCID: string;
    referenceHash: string;
  }) => Promise<void>;

  onMount(async () => {
    const { referenceCID, referenceHash } = await uploadPromise;

    console.log("[CreateCoinSheet] referenceCID", referenceCID);

    status = "creating";

    await createTransactionPromise({ referenceCID, referenceHash });

    status = "success";
  });
</script>

<BottomSheetContent variant="shitzu">
  <slot name="header">
    <div class="flex items-center justify-between w-full">
      <h2 class="text-lg font-bold">{status}</h2>
    </div>
  </slot>

  <div class="text-white">
    {#if status === "ipfs-uploading"}
      <div class="flex flex-col items-center h-full w-full justify-center">
        <p>Uploading image to IPFS...</p>
      </div>
    {:else if status === "creating"}
      <p>Creating coin...</p>
    {:else if status === "success"}
      <p>Coin created!</p>
    {/if}
  </div>
</BottomSheetContent>
