<script lang="ts">
  import { BottomSheetContent } from "$lib/layout/BottomSheet";
  import { close } from "$lib/layout/BottomSheet/Container.svelte";
  import type { UnionModuleState } from "$lib/models";
  import { NEAR_WALLETS, wallet } from "$lib/near";
  import { isMobile } from "$lib/util";

  export let variant: "shitzu" | "funmeme" = "shitzu";

  const modules$ = wallet.modules$;

  async function handleWalletClick(unionMod: UnionModuleState) {
    await wallet.loginViaWalletSelector(unionMod);
    close();
  }
</script>

<BottomSheetContent {variant}>
  <slot slot="header">
    <h1
      class="ml-3 {variant === 'shitzu'
        ? 'text-lime'
        : 'text-shitzu-4'} text-2xl"
    >
      Select Wallet
    </h1>
  </slot>
  <slot>
    <div
      class="mx-auto flex flex-col gap-4 w-full max-w-xs mt-3 {variant ===
      'shitzu'
        ? 'text-lime'
        : 'text-shitzu-4'}"
    >
      {#await $modules$ then modules}
        {#each modules as mod}
          <div class="flex gap-2 items-center">
            <button
              disabled={!mod.metadata.available}
              on:click={() => handleWalletClick(mod)}
              class="hover:bg-lime/15 p-2 rounded-xl flex items-center flex-1"
            >
              <img
                src={mod.metadata.iconUrl}
                alt={mod.metadata.name}
                class={`w-10 h-10 object-contain mr-5 ${mod.metadata.name.replaceAll(" ", "-").toLowerCase()}`}
              />
              <div class="flex flex-col text-left uppercase mr-auto">
                <span>{mod.metadata.name}</span>
                {#if mod.metadata.description != null}
                  <span class="text-sm text-coolgray">
                    {new URL(NEAR_WALLETS[mod.id].url).hostname}
                  </span>
                {/if}
              </div>
            </button>
            {#if mod.type === "injected" && !isMobile()}
              {#if NEAR_WALLETS[mod.id].extensionUrl != null}
                <a
                  href={NEAR_WALLETS[mod.id].extensionUrl}
                  target="_blank"
                  rel="noopener"
                  class=" hover:bg-lime/15 p-2 rounded-xl"
                  on:click|stopPropagation
                >
                  <div class="i-mdi:download w-8 h-8" />
                </a>
              {:else if mod.metadata.downloadUrl != null}
                <a
                  href={mod.metadata.downloadUrl}
                  target="_blank"
                  rel="noopener"
                  class=" hover:bg-lime/15 p-2 rounded-xl"
                  on:click|stopPropagation
                >
                  <div class="i-mdi:download w-8 h-8" />
                </a>
              {/if}
            {/if}
          </div>
        {/each}

        {#if modules.length % 2 === 1}
          <div />
        {/if}
      {/await}
    </div>
  </slot>
</BottomSheetContent>
