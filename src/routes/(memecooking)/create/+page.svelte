<script lang="ts">
  import DropZone from "svelte-file-dropzone";

  import CreateCoinSheet from "$lib/components/memecooking/BottomSheet/CreateCoinSheet.svelte";
  import { openBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
  import { MemeCooking, wallet } from "$lib/near";
  import { imageFileToIcon, imageFileToBase64, FixedNumber } from "$lib/util";
  import { calculateReferenceHash } from "$lib/util/cid";

  const totalSupply = "1000000000000000000000000000000000";

  let name: string = "";
  let ticker: string = "";
  let description: string = "";
  let image: string | null = null; // for preview
  let icon: string | null = null; // 96x96 version of image
  let imageFile: File | null = null;
  let twitterLink: string = "";
  let telegramLink: string = "";
  let website: string = "";
  let durationMs: string = (1000 * 60 * 60 * 24 * 7).toString();

  let status: "idle" | "ipfs-uploading" | "creating" = "idle";

  const { accountId$ } = wallet;

  $: storageCost = MemeCooking.createMemeStorageCost(
    $accountId$ || "",
    durationMs,
    name,
    ticker,
    icon || "",
    24,
    totalSupply,
    "ipfs://bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku",
    "EiC+qKUoJBa3iRpHrsBFrbUqe6rLgGfpRm7L6tfCz5sSjA==",
    "wrap.near",
  ).then((cost) => {
    // Add dust to the cost
    return ((BigInt(cost) * BigInt(105)) / BigInt(100)).toString();
  });

  async function handleFilesSelect(
    e: CustomEvent<{
      acceptedFiles: File[];
      fileRejections: File[];
    }>,
  ) {
    const { acceptedFiles, fileRejections } = e.detail;
    console.log({ acceptedFiles, fileRejections });
    const file = acceptedFiles[0];
    if (file) {
      imageFile = file;
      image = await imageFileToBase64(file);
      icon = await imageFileToIcon(file);
    }
  }

  async function createCoin() {
    // Add your logic to handle form submission here

    if (!name || !ticker || !description || !image || !imageFile || !icon) {
      console.error("Please fill in all fields");
      return;
    }

    console.log("[createCoin] executing...");

    const referenceContent = JSON.stringify({
      description,
      twitterLink,
      telegramLink,
      website,
    });
    const body = new FormData();
    body.append("imageFile", imageFile);
    body.append("reference", referenceContent);
    const uploadPromise = fetch("/api/create", {
      method: "POST",
      body,
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to upload image");
        }
        return res.json();
      })
      .then(async ({ imageCID, referenceCID }) => {
        const referenceHash = await calculateReferenceHash({
          ...JSON.parse(referenceContent),
          image: imageCID,
        });
        return { imageCID, referenceCID, referenceHash };
      })
      .catch((e) => {
        console.error(e);
        throw e;
      });

    const createTransactionPromise = async ({
      referenceCID,
      referenceHash,
    }: {
      referenceCID: string;
      referenceHash: string;
    }) => {
      status = "creating";
      return await MemeCooking.createMeme(
        wallet,
        {
          name,
          symbol: ticker,
          decimals: 24,
          depositTokenId: "wrap.testnet",
          durationMs,
          totalSupply,
          icon: icon!,
          reference: referenceCID,
          referenceHash,
        },
        await storageCost,
        {
          onSuccess: () => {
            status = "idle";
            name = "";
            ticker = "";
            description = "";
            image = null;
            icon = null;
            imageFile = null;
            twitterLink = "";
            telegramLink = "";
            website = "";
          },
        },
      );
    };

    openBottomSheet(CreateCoinSheet, {
      uploadPromise,
      createTransactionPromise,
    });
  }
</script>

<div class="flex flex-col items-center min-h-screen text-white">
  <div class="w-full max-w-md p-4 space-y-4 rounded-lg">
    <div class="flex justify-center items-center">
      <a href="/board" class="text-2xl font-500">[go back]</a>
    </div>

    <div class="space-y-2">
      <label for="name" class="block text-sm text-shitzu-4 font-600">
        name
      </label>
      <input
        id="name"
        type="text"
        bind:value={name}
        autocomplete="off"
        class="w-full p-2 bg-gray-700 rounded text-white border border-white"
      />
    </div>
    <div class="space-y-2">
      <label for="name" class="block text-sm text-shitzu-4 font-600">
        ticker
      </label>
      <input
        id="ticker"
        type="text"
        bind:value={ticker}
        autocomplete="off"
        class="w-full p-2 bg-gray-700 rounded text-white border border-white"
      />
    </div>
    <div class="space-y-2">
      <label for="name" class="block text-sm text-shitzu-4 font-600">
        description
      </label>
      <textarea
        id="description"
        bind:value={description}
        class="w-full p-2 bg-gray-700 rounded text-white border border-white"
      />
    </div>
    <div class="space-y-2">
      <label
        for="name"
        class="block text-sm text-shitzu-4 font-600 inline-flex items-center gap-2"
      >
        image
        {#if image}
          <button
            on:click={() => {
              image = null;
            }}
          >
            <div class="i-mdi:reload size-5" />
          </button>
        {/if}
      </label>
      {#if image}
        <div class="w-full max-h-60 flex justify-center items-center">
          <img src={image} alt="token icon" class="max-h-60" />
        </div>
      {:else}
        <div class="relative w-full">
          <DropZone
            containerClasses="opacity-0 absolute inset-0 w-full h-full"
            accept={[".png", ".jpg", ".jpeg", ".svg", ".gif"]}
            on:drop={handleFilesSelect}
          />
          <div
            class="flex flex-col justify-center items-center w-full bg-gray-700 rounded-lg h-40 gap-2 border border-white"
          >
            <div
              class="i-mdi:download size-16 py-5 text-white/25 pointer-events-none cursor-pointer"
            />
            <div class="text-white/75">
              <b>Choose a file</b> or drag it here
            </div>
          </div>
        </div>
      {/if}
      <!-- <input
        id="image"
        type="file"
        on:change={handleFileChange}
        class="w-full p-2 bg-gray-700 rounded text-white border border-white"
      /> -->
    </div>
    <details class="space-y-2">
      <summary class="text-sm text-shitzu-4 cursor-pointer">
        Show more options
      </summary>
      <div class="space-y-2">
        <label for="name" class="block text-sm text-shitzu-4 font-600">
          twitter link (optional)
        </label>
        <input
          id="twitterLink"
          type="text"
          bind:value={twitterLink}
          placeholder="(optional)"
          class="w-full p-2 bg-gray-700 rounded text-white border border-white"
        />
      </div>
      <div class="space-y-2">
        <label for="name" class="block text-sm text-shitzu-4 font-600">
          telegram link
        </label>
        <input
          id="telegramLink"
          type="text"
          bind:value={telegramLink}
          placeholder="(optional)"
          class="w-full p-2 bg-gray-700 rounded text-white border border-white"
        />
      </div>
      <div class="space-y-2">
        <label for="name" class="block text-sm text-shitzu-4 font-600">
          website
        </label>
        <input
          id="website"
          type="text"
          bind:value={website}
          placeholder="(optional)"
          class="w-full p-2 bg-gray-700 rounded text-white border border-white"
        />
      </div>
    </details>
    <button
      on:click={createCoin}
      class="w-full p-2 bg-shitzu-4 text-white rounded flex justify-center items-center"
      disabled={status !== "idle"}
    >
      {#if status === "ipfs-uploading"}
        <div class="flex justify-center items-center">
          <div class="i-svg-spinners:pulse size-4 mr-1" />
          <span>Making sure your meme won't be lost</span>
        </div>
      {:else if status === "creating"}
        <div class="flex justify-center items-center">
          <div class="i-svg-spinners:pulse size-4 mr-1" />
          <span>Creating your meme</span>
        </div>
      {:else}
        Create coin
      {/if}
    </button>
    {#await storageCost}
      <div class="flex justify-center items-center">
        <div class="i-svg-spinners:6-dots-rotate w-12 h-12 bg-gray-7 m-a" />
      </div>
    {:then storageCost}
      <div class="text-sm text-center">
        Storage cost: ~{new FixedNumber(storageCost, 24).format({
          maximumFractionDigits: 2,
          maximumSignificantDigits: 2,
        })} NEAR
      </div>
    {/await}
  </div>
</div>
