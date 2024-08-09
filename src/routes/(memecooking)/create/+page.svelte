<script lang="ts">
  import type {
    FinalExecutionStatus,
    FinalExecutionStatusBasic,
  } from "near-api-js/lib/providers";
  import { debounce } from "perfect-debounce";
  import { writable } from "svelte/store";
  import DropZone from "svelte-file-dropzone";

  import { goto } from "$app/navigation";
  import { TokenInput } from "$lib/components";
  import SelectBox from "$lib/components/SelectBox.svelte";
  import CreateCoinSheet from "$lib/components/memecooking/BottomSheet/CreateCoinSheet.svelte";
  import InputField from "$lib/components/memecooking/InputField.svelte";
  import { addToast } from "$lib/components/memecooking/Toast.svelte";
  import {
    close,
    openBottomSheet,
  } from "$lib/layout/BottomSheet/Container.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { MemeCooking, wallet } from "$lib/near";
  import {
    imageFileToIcon,
    imageFileToBase64,
    FixedNumber,
    isMobile,
    imageUrlToBase64,
    base64ToIcon,
  } from "$lib/util";
  import { calculateReferenceHash } from "$lib/util/cid";

  // add default from `meme_to_cto` local storage

  let name: string = "";
  let ticker: string = "";
  let description: string = "";
  let image: string | null = null; // for preview
  let icon: string | null = null; // 96x96 version of image
  let imageFile: File | null = null;
  let imageCID: string | null = null;
  let twitterLink: string = "";
  let telegramLink: string = "";
  let website: string = "";
  let decimals = 18;
  let totalSupply: TokenInput;
  let totalSupplyValue$ = writable<string | undefined>("1000000000");
  $: totalSupply$ = totalSupply?.u128$;

  let durationOptions = [
    { label: "5 minutes", value: (1000 * 60 * 5).toString() },
    { label: "1 hour", value: (1000 * 60 * 60).toString() },
    { label: "1 day", value: (1000 * 60 * 60 * 24).toString() },
  ];
  let durationMs = durationOptions[2]!;
  let ctoFrom: number | null = null;

  $: imageReady = imageCID || imageFile;

  const memeToCto = localStorage.getItem("meme_to_cto");
  if (memeToCto) {
    const savedMeme = JSON.parse(memeToCto) as Meme;

    name = savedMeme.name;
    ticker = savedMeme.symbol;
    description = savedMeme.description || "";
    image = `${import.meta.env.VITE_IPFS_GATEWAY}/${savedMeme.image}` || null;
    if (image) {
      imageUrlToBase64(image).then((base64) => {
        base64ToIcon(base64).then((newIcon) => {
          icon = newIcon;
        });
      });
    }
    imageCID = image?.split("/").pop() || null;
    ctoFrom = savedMeme.meme_id;

    localStorage.removeItem("meme_to_cto");
  }

  const { accountId$ } = wallet;

  const storageCost$ = writable<ReturnType<typeof fetchStorageCost>>(
    new Promise<never>(() => {}),
  );
  const fetchStorageCost = debounce(
    (
      accountId: string,
      durationMs: string,
      name: string,
      ticker: string,
      icon: string,
      decimals: number,
      totalSupply: string,
    ) =>
      MemeCooking.createMemeStorageCost(
        accountId,
        durationMs,
        name,
        ticker,
        icon || "",
        decimals,
        totalSupply,
        // TODO remove hardcoded reference
        "ipfs://bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku",
        "EiC+qKUoJBa3iRpHrsBFrbUqe6rLgGfpRm7L6tfCz5sSjA==",
        import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID,
      ).then((cost) => {
        // Add dust to the cost
        const res = ((BigInt(cost) * BigInt(105)) / BigInt(100)).toString();
        $storageCost$ = Promise.resolve(res);
        return res;
      }),
    500,
  );
  $: fetchStorageCost(
    $accountId$ || "",
    durationMs.value,
    name,
    ticker,
    icon || "",
    decimals,
    $totalSupply$?.toU128() ?? "",
  );

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

  // let isTwitterValid = true;
  // let isTelegramValid = true;
  // let isWebsiteValid = true;

  async function createCoin() {
    if (!$accountId$) {
      addToast({
        data: {
          type: "simple",
          data: {
            title: "Error",
            description: "Please Connect Wallet",
            color: "red",
          },
        },
      });
      return;
    }
    // Add your logic to handle form submission here

    if (!name || !ticker || !description || !imageReady || !icon) {
      console.error("Please fill in all fields");
      return;
    }

    console.log("[createCoin] executing...");
    const reference: {
      description: string;
      twitterLink: string;
      telegramLink: string;
      website: string;
      ctoFrom?: number;
    } = {
      description,
      twitterLink,
      telegramLink,
      website,
    };
    if (ctoFrom) {
      reference.ctoFrom = ctoFrom;
    }
    const referenceContent = JSON.stringify(reference);

    const body = new FormData();

    if (imageCID) {
      body.append("imageCID", imageCID);
    } else if (imageFile) {
      body.append("imageFile", imageFile);
    }
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
      imageCID: string;
      referenceCID: string;
      referenceHash: string;
    }) => {
      return await MemeCooking.createMeme(
        wallet,
        {
          name,
          symbol: ticker,
          decimals,
          depositTokenId: import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID,
          durationMs: durationMs.value,
          totalSupply: $totalSupply$!.toU128(),
          icon: icon!,
          reference: referenceCID,
          referenceHash,
        },
        await $storageCost$,
        {
          onSuccess: async (outcome) => {
            function isFinalExecutionStatus(
              status: FinalExecutionStatus | FinalExecutionStatusBasic,
            ): status is FinalExecutionStatus {
              return (
                typeof status === "object" &&
                (status.SuccessValue !== undefined ||
                  status.Failure !== undefined)
              );
            }

            // replace with logic to make sure that all the data is ready to be displayed
            if (outcome) {
              if (
                isFinalExecutionStatus(outcome.status) &&
                typeof outcome.status.SuccessValue === "string"
              ) {
                const decodedOutcome = atob(outcome.status.SuccessValue);

                if (isMobile()) {
                  goto(`/${decodedOutcome}`);
                } else {
                  goto(`/meme/${decodedOutcome}`);
                }
                close();
              }
            }
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

<!-- listen for ctrl + v the image -->
<svelte:window
  on:paste={async (event) => {
    // @ts-expect-error originalEvent
    const items = (event.clipboardData || event.originalEvent.clipboardData)
      .items;
    for (const item of items) {
      if (item.kind === "file") {
        const blob = item.getAsFile();
        var reader = new FileReader();
        reader.onload = async function (event) {
          if (event.target && typeof event.target.result === "string") {
            imageFile = blob;
            image = event.target.result;
            icon = await imageFileToIcon(blob);
          }
        }; // data url!
        reader.readAsDataURL(blob);
      }
    }
  }}
/>

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
      <label for="ticker" class="block text-sm text-shitzu-4 font-600">
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
      <label for="description" class="block text-sm text-shitzu-4 font-600">
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
        class="block text-sm text-shitzu-4 font-600 inline-flex items-center gap-2"
      >
        image
        {#if imageReady}
          <button
            on:click={() => {
              image = null;
              icon = null;
            }}
          >
            <div class="i-mdi:reload size-5" />
          </button>
        {/if}
      </label>
      {#if image}
        <div class="w-full max-h-60 flex justify-center items-center">
          <img src={image || imageCID} alt="token icon" class="max-h-60" />
        </div>
      {:else}
        <div class="relative w-full">
          <DropZone
            containerClasses="opacity-0 absolute inset-0 w-full h-full"
            accept={[".png", ".jpg", ".jpeg", ".svg", ".gif", ".webp", ".avif"]}
            on:drop={handleFilesSelect}
          />
          <div
            class="flex flex-col justify-center items-center w-full bg-gray-700 rounded-lg h-40 gap-2 border border-white"
          >
            <div
              class="i-mdi:download size-16 py-5 text-white/25 pointer-events-none cursor-pointer"
            />
            <div class="text-white/75">
              <b>Choose a file</b>, <b>paste</b> or <b>drag it here</b>
            </div>
          </div>
        </div>
      {/if}

      {#if icon}
        <div
          class="block text-sm text-shitzu-4 font-600 inline-flex items-center gap-2"
        >
          on-chain icon preview
        </div>
        <div class="w-full max-h-60 flex justify-center items-center">
          <img src={icon} alt="token icon" class="border-rd-full" />
        </div>
      {/if}
    </div>
    <div class="space-y-2">
      <label for="name" class="block text-sm text-shitzu-4 font-600">
        duration
      </label>
      <SelectBox
        options={durationOptions}
        bind:selected={durationMs}
        sameWidth
      />
    </div>
    <details class="space-y-4">
      <summary class="text-sm text-shitzu-4 cursor-pointer">
        Show more options
      </summary>
      <div class="space-y-2">
        <InputField
          label="twitter link"
          bind:value={twitterLink}
          placeholder="(optional)"
          validate={(value) => {
            if (!value || typeof value === "number") {
              return "";
            }

            const error = /^(https:\/\/(twitter|x)\.com\/)/.test(value)
              ? ""
              : "website should start with https://twitter.com/ or https://x.com/";
            return error;
          }}
        />
      </div>
      <div class="space-y-2">
        <InputField
          label="telegram link"
          bind:value={telegramLink}
          placeholder="(optional)"
          validate={(value) => {
            if (!value || typeof value === "number") {
              return "";
            }

            const error = /^(https:\/\/t\.me\/)/.test(value)
              ? ""
              : "website should start with https://t.me/";
            return error;
          }}
        />
      </div>
      <div class="space-y-2">
        <InputField
          label="website"
          bind:value={website}
          placeholder="(optional)"
          validate={(value) => {
            if (!value || typeof value === "number") {
              return "";
            }

            const error = /^(https?:\/\/)/.test(value)
              ? ""
              : "website should start with http:// or https://";
            return error;
          }}
        />
      </div>
      <div class="space-y-2">
        <InputField
          label="decimals"
          type="number"
          bind:value={decimals}
          min={0}
          max={24}
          step={1}
          validate={(value) => {
            if (!value || typeof value === "string") {
              return "";
            }

            if (value < 0) {
              return "must be at least 0";
            } else if (value > 24) {
              return "must be at most 24";
            }
            return "";
          }}
        />
      </div>
      <div class="space-y-2">
        <label for="description" class="block text-sm text-shitzu-4 font-600">
          total supply
        </label>
        <TokenInput
          class="w-full p-2 bg-gray-700 rounded text-white border border-white"
          {decimals}
          bind:this={totalSupply}
          bind:value={$totalSupplyValue$}
        />
      </div>
    </details>
    <button
      on:click={createCoin}
      class="w-full p-2 bg-shitzu-4 text-white rounded flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={!name || !ticker || !description || !imageReady || !icon}
    >
      Create coin
    </button>
    {#await $storageCost$}
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
