<script lang="ts">
  import { ModalContent, modal$ } from "$lib/layout";
  import type { UnionModuleState } from "$lib/models";
  import { NEAR_WALLETS, wallet } from "$lib/near";
  import { isMobile } from "$lib/util";

  const modules$ = wallet.modules$;

  async function handleWalletClick(unionMod: UnionModuleState) {
    await wallet.loginViaWalletSelector(unionMod);
    $modal$ = null;
  }
</script>

<ModalContent header="Select Wallet">
  <div class="mx-auto flex flex-col gap-8 w-full max-w-xs">
    {#await $modules$ then modules}
      {#each modules as mod}
        <button
          disabled={!mod.metadata.available}
          on:click={() => handleWalletClick(mod)}
        >
          <div class="flex mx-auto items-center">
            <img
              src={mod.metadata.iconUrl}
              alt={mod.metadata.name}
              class={`w-10 h-10 object-contain mr-5 ${mod.metadata.name.replaceAll(" ", "-").toLowerCase()}`}
            />
            <div class="flex flex-col text-left text-lime uppercase mr-auto">
              <span>{mod.metadata.name}</span>
              {#if mod.metadata.description != null}
                <span class="text-sm text-coolgray">
                  {new URL(NEAR_WALLETS[mod.id].url).hostname}
                </span>
              {/if}
            </div>
            {#if mod.type === "injected" && !isMobile()}
              {#if NEAR_WALLETS[mod.id].extensionUrl != null}
                <a
                  href={NEAR_WALLETS[mod.id].extensionUrl}
                  target="_blank"
                  rel="noopener"
                  class="text-lime"
                  on:click|stopPropagation
                >
                  <div class="i-mdi:download w-8 h-8" />
                </a>
              {:else if mod.metadata.downloadUrl != null}
                <a
                  href={mod.metadata.downloadUrl}
                  target="_blank"
                  rel="noopener"
                  class="text-lime"
                  on:click|stopPropagation
                >
                  <div class="i-mdi:download w-8 h-8" />
                </a>
              {/if}
            {/if}
          </div>
        </button>
      {/each}

      {#if modules.length % 2 === 1}
        <div />
      {/if}
    {/await}
  </div>
</ModalContent>

<style lang="scss">
  .wallets {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;

    :global(> *) {
      height: 3rem;
      flex: 1 0 15rem;
      max-width: 20rem;
    }

    :global(.mdc-button__icon) {
      padding: 0.2rem;
    }
  }

  .wallet {
    display: flex;
    justify-content: space-between;
    margin: 0.6rem;
    align-items: center;
    width: 100%;
    max-height: 100%;
    --img-size: 2.2rem;
  }

  .wallet-name {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .icon {
    border-radius: 25%;
    background-color: var(--button-bg-color-bright);
    padding: 0.2rem;

    &.meteor-wallet,
    &.here-wallet {
      background-color: var(--button-bg-color);
    }
  }
</style>
