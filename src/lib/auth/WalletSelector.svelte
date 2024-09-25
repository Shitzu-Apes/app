<script lang="ts">
  import WalletDisclaimerContent from "./WalletDisclaimerContent.svelte";
  import {
    acceptWalletDisclaimer,
    hasAcceptedWalletDisclaimer,
  } from "./showWalletSelector";

  import { BottomSheetContent } from "$lib/layout/BottomSheet";
  import {
    closeBottomSheet,
    openBottomSheet,
  } from "$lib/layout/BottomSheet/Container.svelte";
  import type { UnionModuleState } from "$lib/models";
  import type { colorVariant } from "$lib/models/variant";
  import { NEAR_WALLETS, wallet } from "$lib/near";
  import { isMobile } from "$lib/util";

  export let variant: colorVariant = "lime";

  const modules$ = wallet.modules$;

  let disclaimerAccepted = hasAcceptedWalletDisclaimer();

  async function handleWalletClick(unionMod: UnionModuleState) {
    await wallet.loginViaWalletSelector(unionMod);
    closeBottomSheet();
  }
</script>

<BottomSheetContent {variant}>
  <slot slot="header">
    <h1
      class="ml-3 {variant === 'lime' ? 'text-lime' : 'text-shitzu-4'} text-2xl"
    >
      {disclaimerAccepted ? "Select Wallet" : "Disclaimer"}
    </h1>
  </slot>
  <slot>
    {#if !disclaimerAccepted}
      <WalletDisclaimerContent
        {variant}
        on:acceptDisclaimer={() => {
          acceptWalletDisclaimer();

          if (wallet.isTG) {
            wallet.loginViaHere();
          } else {
            disclaimerAccepted = true;
          }
        }}
      />
    {:else}
      <div
        class="mx-auto flex flex-col gap-4 w-full max-w-xs mt-3 pb-6 {variant ===
        'lime'
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
                  <span>{NEAR_WALLETS[mod.id].name ?? mod.metadata.name}</span>
                  {#if NEAR_WALLETS[mod.id].url != null}
                    <span class="text-sm text-coolgray">
                      {new URL(NEAR_WALLETS[mod.id].url ?? "").hostname}
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
                {:else if mod.metadata.downloadUrl != null && mod.id !== "ethereum-wallets"}
                  <a
                    href={mod.metadata.downloadUrl}
                    target="_blank"
                    rel="noopener"
                    class=" hover:bg-lime/15 p-2 rounded-xl"
                    on:click|stopPropagation
                  >
                    <div class="i-mdi:download w-8 h-8" />
                  </a>
                {:else if NEAR_WALLETS[mod.id].infoSheet != null}
                  <button
                    class="hover:bg-lime/15 p-2 rounded-xl"
                    on:click={() => {
                      openBottomSheet(NEAR_WALLETS[mod.id].infoSheet);
                    }}
                  >
                    <div class="i-mdi:information-outline w-8 h-8" />
                  </button>
                {/if}
              {/if}
            </div>
          {/each}
        {/await}
      </div>
    {/if}
  </slot>
</BottomSheetContent>

<style lang="scss">
  :global(.bitte-wallet) {
    background: white;
    border-radius: 0.25rem;
  }
</style>
