<script lang="ts">
  import type {
    FinalExecutionStatus,
    FinalExecutionStatusBasic,
  } from "near-api-js/lib/providers";
  import { debounce } from "perfect-debounce";
  import { writable } from "svelte/store";
  import DropZone from "svelte-file-dropzone";
  import { z } from "zod";

  import FgBanner from "./FGBanner.svelte";
  import SoftcapDefault, { CAP_DEFAULT_OPTIONS } from "./SoftcapDefault.svelte";
  import TextAreaField from "./TextAreaField.svelte";
  import TextInputField from "./TextInputField.svelte";

  import { goto } from "$app/navigation";
  import { showWalletSelector } from "$lib/auth";
  import { TokenInput } from "$lib/components";
  import DurationSlider from "$lib/components/DurationSlider.svelte";
  import { addToast } from "$lib/components/Toast.svelte";
  import Tooltip from "$lib/components/Tooltip.svelte";
  import CreateCoinSheet from "$lib/components/memecooking/BottomSheet/CreateCoinSheet.svelte";
  import InputField from "$lib/components/memecooking/InputField.svelte";
  import {
    closeBottomSheet,
    openBottomSheet,
  } from "$lib/layout/BottomSheet/Container.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { wallet } from "$lib/near";
  import { MemeCooking } from "$lib/near/memecooking";
  import {
    imageFileToIcon,
    imageFileToBase64,
    FixedNumber,
    imageUrlToBase64,
    base64ToIcon,
  } from "$lib/util";
  import { calculateReferenceHash } from "$lib/util/cid";

  // add default from `meme_to_cto` local storage

  const nameSchema = z
    .string({})
    .min(1, "Name is required")
    .max(50, "Name should be less than 50 characters");
  const tickerSchema = z
    .string({})
    .min(1, "Ticker is required")
    .max(10, "Ticker should be less than 10 characters")
    .regex(
      /^[a-zA-Z0-9-_]+$/,
      "Ticker should only contain alphanumeric characters, '-', and '_'",
    );
  const descriptionSchema = z
    .string()
    .min(1, "Description is required")
    .max(100, "Description should be less than 100 characters");
  const imageSchema = z.string().nullable();
  const iconSchema = z.string().nullable();
  const imageFileSchema = z.instanceof(File).nullable();
  const imageCIDSchema = z.string().nullable();
  const twitterLinkSchema = z.string().regex(/^(https:\/\/(twitter|x)\.com\/)/);
  const telegramLinkSchema = z.string().regex(/^(https:\/\/t\.me\/)/);
  const websiteSchema = z.string().regex(/^(https:\/\/)/);
  const decimalsSchema = z.number().int().min(0);
  const totalSupplySchema = z.instanceof(TokenInput);
  const totalSupplyValueSchema = z.string().optional();

  // Add new schemas for softCap and hardCap
  const softCapSchema = z.string();
  const hardCapSchema = z.string().nullable();

  let name: z.infer<typeof nameSchema> = "";
  let ticker: z.infer<typeof tickerSchema> = "";
  let description: z.infer<typeof descriptionSchema> = "";
  let image: z.infer<typeof imageSchema> = null; // for preview
  let icon: z.infer<typeof iconSchema> = null; // 96x96 version of image
  let imageFile: z.infer<typeof imageFileSchema> = null;
  let imageCID: z.infer<typeof imageCIDSchema> = null;
  let twitterLink: z.infer<typeof twitterLinkSchema> = "";
  let telegramLink: z.infer<typeof telegramLinkSchema> = "";
  let website: z.infer<typeof websiteSchema> = "";
  let decimals: z.infer<typeof decimalsSchema> = 18;
  let totalSupply: z.infer<typeof totalSupplySchema>;
  let totalSupplyValue$ =
    writable<z.infer<typeof totalSupplyValueSchema>>("1000000000");
  $: totalSupply$ = totalSupply?.u128$;

  // Add variables for softCap and hardCap
  let softCap: z.infer<typeof softCapSchema> =
    CAP_DEFAULT_OPTIONS.small.softCap;
  let hardCap: z.infer<typeof hardCapSchema> =
    CAP_DEFAULT_OPTIONS.small.hardCap;
  let hardCapEnabled: boolean = true;
  let ctoFrom: number | null = null;

  // Add a new variable for duration
  let durationMs = 1000 * 60 * 60 * 24; // Default duration is 24 hours

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
      softCap: string,
      hardCap?: string | null,
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
        softCap,
        hardCap || undefined,
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
    durationMs.toString(),
    name,
    ticker,
    icon || "",
    decimals,
    $totalSupply$?.toU128() ?? "",
    softCap,
    hardCap,
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

      if (file.type === "image/svg+xml") {
        if (file.size > 10240) {
          addToast({
            data: {
              type: "simple",
              data: {
                title: "Error",
                description: "Image size should be less than 10KB",
                color: "red",
              },
            },
          });
          image = null;
          imageFile = null;
          return;
        }
        icon = image;
      } else {
        try {
          icon = await imageFileToIcon(file);
        } catch (e) {
          console.error(e);
          addToast({
            data: {
              type: "simple",
              data: {
                title: "Error",
                description: "Image is not a valid icon",
                color: "red",
              },
            },
          });
          image = null;
          imageFile = null;
        }
      }
    }
  }

  async function createCoin() {
    if (!$accountId$) {
      showWalletSelector("shitzu");
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
      twitterLink: twitterLink || "",
      telegramLink: telegramLink || "",
      website: website || "",
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
        const res = await fetch(
          `${import.meta.env.VITE_IPFS_GATEWAY}/${referenceCID}`,
        );
        if (!res.ok) {
          throw new Error("not pinned");
        }
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
      return MemeCooking.createMeme(
        wallet,
        {
          name,
          symbol: ticker,
          decimals,
          depositTokenId: import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID,
          durationMs: durationMs.toString(),
          totalSupply: $totalSupply$!.toU128(),
          icon: icon!,
          reference: referenceCID,
          referenceHash,
          softCap,
          hardCap: hardCap || undefined,
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

                goto(`/meme/${decodedOutcome}`);
                closeBottomSheet();
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
      <a href="/board" class="text-2xl font-500 hover:font-bold">[go back]</a>
    </div>

    <FgBanner />

    <div class="space-y-2">
      <label
        class="block text-sm text-shitzu-4 font-600 inline-flex items-center gap-1"
      >
        image
        <Tooltip
          info="use a square image ratio for optimal display of the ticker image."
        >
          <div class="size-4 i-mdi:information-outline text-amber-5" />
        </Tooltip>
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
    </div>
    <TextInputField
      label="name"
      bind:value={name}
      schema={nameSchema}
      validateOnInput={true}
    />

    <TextInputField
      label="ticker"
      bind:value={ticker}
      schema={tickerSchema}
      validateOnInput={true}
    >
      <slot slot="icon">
        {#if icon}
          <div class="size-6 flex justify-center items-center">
            <img src={icon} alt="token icon" class="rounded-full" />
          </div>
        {/if}
      </slot>
    </TextInputField>
    <TextAreaField
      label="description"
      bind:value={description}
      schema={descriptionSchema}
      validateOnInput={true}
    />

    <DurationSlider bind:value={durationMs} />

    <SoftcapDefault bind:softCap bind:hardCap bind:hardCapEnabled />

    <details class="space-y-4">
      <summary class="text-sm text-shitzu-4 cursor-pointer">
        Show more options
      </summary>
      <TextInputField
        label="twitter link"
        bind:value={twitterLink}
        placeholder="(optional)"
        schema={twitterLinkSchema}
        validateOnInput={true}
      />
      <TextInputField
        label="telegram link"
        bind:value={telegramLink}
        placeholder="(optional)"
        schema={telegramLinkSchema}
        validateOnInput={true}
      />
      <TextInputField
        label="website"
        bind:value={website}
        placeholder="(optional)"
        schema={websiteSchema}
        validateOnInput={true}
      />
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
          tooltip="Only change if you know what you are doing."
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
      disabled={(() => {
        const schema = z.object({
          name: nameSchema,
          ticker: tickerSchema,
          description: descriptionSchema,
          icon: z.string(),
          twitterLink: twitterLinkSchema.optional(),
          telegramLink: telegramLinkSchema.optional(),
          website: websiteSchema.optional(),
        });

        const result = schema.safeParse({
          name,
          ticker,
          description,
          icon,
          twitterLink: twitterLink || undefined,
          telegramLink: telegramLink || undefined,
          website: website || undefined,
        });
        return !result.success;
      })()}
    >
      Create token
    </button>
    <div class="flex justify-center gap-2 text-sm text-center">
      <span> Storage cost: </span>
      {#await $storageCost$}
        <div class="i-svg-spinners:3-dots-fade size-5 bg-gray-7" />
      {:then storageCost}
        <span>
          ~{new FixedNumber(storageCost, 24).format({
            maximumFractionDigits: 2,
            maximumSignificantDigits: 2,
          })} NEAR
        </span>
      {/await}
    </div>
  </div>
</div>
