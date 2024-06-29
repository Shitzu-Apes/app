<script lang="ts">
  import DropZone from "svelte-file-dropzone";

  import { imageFileToBase64 } from "$lib/util";

  let name: string = "";
  let ticker: string = "";
  let description: string = "";
  let image: string | null = null;
  let twitterLink: string = "";
  let telegramLink: string = "";
  let website: string = "";

  // async function handleFileChange(
  //   event: Event & {
  //     currentTarget: EventTarget & HTMLInputElement;
  //   },
  // ) {
  //   if (!event.currentTarget.files) return;
  //   const file = event.currentTarget.files[0];
  //   if (file) {
  //     image = await imageFileToBase64(file);
  //   }
  // }

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
      image = await imageFileToBase64(file);
    }
  }

  function createCoin() {
    // Add your logic to handle form submission here
    console.log({
      name,
      ticker,
      description,
      image,
      twitterLink,
      telegramLink,
      website,
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
      class="w-full p-2 bg-shitzu-4 text-white rounded"
    >
      Create coin
    </button>
    <div class="text-sm text-center">Cost to deploy: ~0.02 NEAR</div>
  </div>
</div>
