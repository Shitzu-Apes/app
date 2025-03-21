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
  import GrowthMateBanner from "./GrowthMateBanner.svelte";
  import NewMemePreview from "./NewMemePreview.svelte";
  import SoftcapDefault, { CAP_DEFAULT_OPTIONS } from "./SoftcapDefault.svelte";
  import StartTimeSelector from "./StartTimeSelector.svelte";
  import TeamAllocationToggle from "./TeamAllocationToggle.svelte";
  import TextAreaField from "./TextAreaField.svelte";
  import TextInputField from "./TextInputField.svelte";

  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import Near from "$lib/assets/Near.svelte";
  import { showWalletSelector } from "$lib/auth";
  import { TokenInput } from "$lib/components";
  import DurationDefault from "$lib/components/DurationDefault.svelte";
  import { addToast } from "$lib/components/Toast.svelte";
  import Tooltip from "$lib/components/Tooltip.svelte";
  import CreateCoinSheet from "$lib/components/memecooking/BottomSheet/CreateCoinSheet.svelte";
  import InputField from "$lib/components/memecooking/InputField.svelte";
  import {
    closeBottomSheet,
    openBottomSheet,
  } from "$lib/layout/BottomSheet/Container.svelte";
  import type { Meme, TeamAllocation } from "$lib/models/memecooking";
  import { nearWallet } from "$lib/near";
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
  let durationMs = 1000 * 60 * 60; // Default duration is 24 hours

  // Bind teamAllocation from the new component
  let teamAllocation: TeamAllocation | null = null;

  // Add a new variable for start time
  let startTimestampMs: string | undefined = undefined;

  $: imageReady = imageCID || imageFile;

  // Handle query params and localStorage initialization
  const initializeFromParams = async () => {
    if (browser) {
      // First check URL params
      const searchParams = $page.url.searchParams;
      const urlParams = {
        name: searchParams.get("name"),
        symbol: searchParams.get("symbol"),
        description: searchParams.get("description"),
        image: searchParams.get("image"),
        twitter: searchParams.get("twitter"),
        telegram: searchParams.get("telegram"),
        website: searchParams.get("website"),
        softCap: searchParams.get("softCap"),
        hardCap: searchParams.get("hardCap"),
      };

      // Then check localStorage
      const memeToCto = localStorage.getItem("meme_to_cto");
      const savedMeme = memeToCto ? (JSON.parse(memeToCto) as Meme) : null;

      // Apply values in order of priority: URL params > localStorage > defaults
      name = urlParams.name || savedMeme?.name || "";
      ticker = urlParams.symbol || savedMeme?.symbol || "";
      description = urlParams.description || savedMeme?.description || "";
      twitterLink = urlParams.twitter || savedMeme?.twitter_link || "";
      telegramLink = urlParams.telegram || savedMeme?.telegram_link || "";
      website = urlParams.website || savedMeme?.website || "";

      // Handle softCap and hardCap
      if (urlParams.softCap) {
        softCap = `${urlParams.softCap}000000000000000000000000`;
      }
      if (urlParams.hardCap) {
        hardCap = `${urlParams.hardCap}000000000000000000000000`;
        hardCapEnabled = true;
      } else if (urlParams.hardCap === "") {
        // If hardCap is explicitly set to empty string, disable it
        hardCap = null;
        hardCapEnabled = false;
      }

      // Handle image separately since it needs processing
      if (urlParams.image) {
        image = urlParams.image;
        try {
          const base64 = await imageUrlToBase64(urlParams.image);
          icon = await base64ToIcon(base64);
          imageCID = urlParams.image.split("/").pop() || null;
        } catch (e) {
          console.error("Failed to process image from URL params:", e);
        }
      } else if (savedMeme?.image) {
        image = `${import.meta.env.VITE_IPFS_GATEWAY}/${savedMeme.image}`;
        try {
          const base64 = await imageUrlToBase64(image);
          icon = await base64ToIcon(base64);
          imageCID = savedMeme.image;
        } catch (e) {
          console.error("Failed to process image from localStorage:", e);
        }
      }

      if (savedMeme) {
        ctoFrom = savedMeme.meme_id;
        localStorage.removeItem("meme_to_cto");
      }
    }
  };

  // Initialize form fields when component mounts
  $: if ($page) {
    initializeFromParams();
  }

  const { accountId$ } = nearWallet;

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
                type: "error",
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
                type: "error",
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
      const createParams = {
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
        hardCap: hardCapEnabled ? (hardCap ?? undefined) : undefined,
        teamAllocation:
          teamAllocation && teamAllocation.allocationBps > 0
            ? {
                allocationBps: teamAllocation.allocationBps,
                vestingDurationMs: teamAllocation.vestingDurationMs,
                cliffDurationMs: teamAllocation.cliffDurationMs,
              }
            : undefined,
        startTimestampMs: startTimestampMs,
      };

      return MemeCooking.createMeme(
        nearWallet,
        createParams,
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

  $: team_allocation_num =
    teamAllocation && $totalSupply$ && teamAllocation.allocationBps > 0
      ? Number(
          ($totalSupply$.toBigInt() *
            BigInt(Math.round(teamAllocation.allocationBps))) /
            10000n,
        )
      : undefined;

  $: memebid = {
    meme_id: 0,
    owner: $accountId$ || "",
    end_timestamp_ms: Date.now() + durationMs,
    start_timestamp_ms: startTimestampMs,
    name: name || "[NAME]",
    symbol: ticker || "[SYMBOL]",
    description: description || "[DESCRIPTION]",
    decimals: decimals,
    total_supply: $totalSupply$?.toU128() ?? "",
    reference: "{}",
    reference_hash: "",
    deposit_token_id: "wrap.near",
    image:
      image ||
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    token_id: "",
    created_timestamp_ms: Date.now(),
    total_deposit: "0",
    is_finalized: false,
    soft_cap: softCap,
    hard_cap: hardCap,
    team_allocation:
      teamAllocation && team_allocation_num
        ? BigInt(team_allocation_num).toString()
        : null,
    vesting_duration_ms: teamAllocation?.vestingDurationMs,
    cliff_duration_ms: teamAllocation?.cliffDurationMs,
    projectedPoolStats: writable({
      mcap: new FixedNumber("0", 24),
      liquidity: new FixedNumber("0", 24),
    }),
    pool_id: null,
    replies_count: 0,
    staker_count: 0,
    twitter_link: twitterLink || "",
    telegram_link: telegramLink || "",
    website: website || "",
    total_deposit_fees: "0",
    total_withdraw_fees: "0",
    last_change_ms: Date.now(),
    created_blockheight: "0",
    twitter_verified: false,
    flag_count: 0,
  } as Meme;

  $: console.log("[create::+page] memebid", memebid);
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

<div class="flex flex-col items-center min-h-screen text-white pb-8">
  <div class="w-full">
    <a
      href="/board"
      class="text-white flex items-center hover:text-shitzu-3 w-fit"
    >
      <div class="i-mdi:chevron-left size-8" />
      Back
    </a>

    <div class="grid lg:grid-cols-[minmax(400px,1fr)_2fr] gap-8 mt-4">
      <!-- Left Column - Preview -->
      <div class="hidden lg:block">
        <NewMemePreview meme={memebid} />
      </div>

      <!-- Right Column - Form -->
      <div class="space-y-4">
        <FgBanner />
        <!-- Image Upload Card -->
        <div class="bg-gray-800 rounded-lg p-4">
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <label
                class="text-base text-shitzu-4 font-600 inline-flex items-center gap-1"
                for="image"
              >
                Image
                <Tooltip
                  info="Use a square image ratio (1:1) for optimal display"
                >
                  <div class="size-4 i-mdi:information-outline text-amber-5" />
                </Tooltip>
              </label>
              {#if imageReady}
                <button
                  class="text-shitzu-4 hover:text-shitzu-3 transition-colors flex items-center gap-1"
                  on:click={() => {
                    image = null;
                    icon = null;
                  }}
                >
                  <div class="i-mdi:reload size-5" />
                  Reset
                </button>
              {/if}
            </div>

            <div class="relative w-full">
              <DropZone
                containerClasses="opacity-0 absolute inset-0 w-full h-full z-10"
                accept={[
                  ".png",
                  ".jpg",
                  ".jpeg",
                  ".svg",
                  ".gif",
                  ".webp",
                  ".avif",
                ]}
                on:drop={handleFilesSelect}
              />

              {#if image}
                <div
                  class="block group relative aspect-square w-full max-w-60 mx-auto"
                >
                  <img
                    src={image || imageCID}
                    alt="token icon"
                    class="w-full h-full object-cover rounded-lg"
                  />
                  <div
                    class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center"
                  >
                    <div class="text-white text-sm">
                      Click or drag to replace
                    </div>
                  </div>
                </div>
              {:else}
                <div
                  class="border-2 border-dashed border-gray-600 rounded-lg p-8 hover:border-shitzu-4 transition-colors"
                >
                  <div class="flex flex-col items-center gap-4">
                    <div class="i-mdi:image-plus text-4xl text-gray-400" />
                    <div class="text-center">
                      <div class="font-medium mb-1">Upload Token Image</div>
                      <div class="text-sm text-gray-400">
                        Drag and drop, paste, or click to select
                      </div>
                    </div>
                    <div class="text-xs text-gray-500">
                      Supported formats: PNG, JPG, SVG, GIF, WEBP
                    </div>
                  </div>
                </div>
              {/if}
            </div>
          </div>
        </div>

        <!-- Basic Info Card -->
        <div class="bg-gray-800 rounded-lg p-4 space-y-4">
          <TextInputField
            label="Name"
            bind:value={name}
            schema={nameSchema}
            validateOnInput={true}
          />

          <TextInputField
            label="Symbol"
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
            label="Description"
            bind:value={description}
            schema={descriptionSchema}
            validateOnInput={true}
          />
        </div>

        <!-- Token Parameters Card -->
        <div class="bg-gray-800 rounded-lg p-4 space-y-4">
          <StartTimeSelector bind:value={startTimestampMs} />
          <DurationDefault bind:value={durationMs} />
          <SoftcapDefault bind:softCap bind:hardCap bind:hardCapEnabled />
          <TeamAllocationToggle bind:teamAllocation />
        </div>

        <!-- Social Links Card -->
        <div class="bg-gray-800 rounded-lg p-4 space-y-4">
          <TextInputField
            label="Twitter Link"
            bind:value={twitterLink}
            placeholder="(optional)"
            schema={twitterLinkSchema}
            validateOnInput={true}
          />
          <TextInputField
            label="Telegram Link"
            bind:value={telegramLink}
            placeholder="(optional)"
            schema={telegramLinkSchema}
            validateOnInput={true}
          />
          <TextInputField
            label="Website"
            bind:value={website}
            placeholder="(optional)"
            schema={websiteSchema}
            validateOnInput={true}
          />
        </div>

        <!-- Advanced Options Card -->
        <div class="bg-gray-800 rounded-lg p-4">
          <details class="space-y-4">
            <summary class="text-base text-shitzu-4 cursor-pointer">
              Show more options
            </summary>
            <div class="space-y-2">
              <InputField
                label="Decimals"
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
              <label
                for="description"
                class="block text-sm text-shitzu-4 font-600"
              >
                Total Supply
              </label>
              <TokenInput
                class="w-full p-2 bg-gray-800 rounded text-white border border-white"
                {decimals}
                bind:this={totalSupply}
                bind:value={$totalSupplyValue$}
              />
            </div>
          </details>
        </div>

        <!-- GrowthMate Banner -->
        <GrowthMateBanner />

        <!-- Create Token Card -->
        <div class="bg-gray-800 rounded-lg p-4 space-y-4">
          <button
            on:click={createCoin}
            class="w-full p-2 bg-shitzu-4 text-white rounded flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-shitzu-5 transition-colors"
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
            <div class="i-lucide:coins size-5" />
            Create token
          </button>

          <div
            class="flex justify-between gap-2 text-sm text-center text-gray-300"
          >
            <span class="text-memecooking-4">Estimated storage cost:</span>
            {#await $storageCost$}
              <div class="i-svg-spinners:3-dots-fade size-5 bg-gray-400" />
            {:then storageCost}
              <span class="font-semibold text-white flex items-center gap-1">
                ~{new FixedNumber(storageCost, 24).format({
                  maximumFractionDigits: 2,
                  maximumSignificantDigits: 2,
                })}
                <Near className="size-4 bg-white text-black rounded-full" />
              </span>
            {/await}
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
