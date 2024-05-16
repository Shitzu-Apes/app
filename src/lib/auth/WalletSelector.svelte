<script lang="ts">
  import { mdiMonitorArrowDown } from "@mdi/js";
  import Button from "@smui/button";
  import { Icon } from "@smui/icon-button";

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
  <div class="wallets">
    {#await $modules$ then modules}
      {#each modules as mod}
        <Button
          disabled={!mod.metadata.available}
          on:click={() => handleWalletClick(mod)}
        >
          <div class="wallet">
            <img
              src={mod.metadata.iconUrl}
              alt={mod.metadata.name}
              class={`icon ${mod.metadata.name.replaceAll(" ", "-").toLowerCase()}`}
            />
            <div class="wallet-name">
              <span>{mod.metadata.name}</span>
              {#if mod.metadata.description != null}
                <span class="url">
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
                  class="download"
                  on:click|stopPropagation
                >
                  <Icon
                    tag="svg"
                    viewBox="0 0 24 24"
                    style="width: 1.8rem; height: 1.8rem;"
                  >
                    <path fill="var(--color-link)" d={mdiMonitorArrowDown} />
                  </Icon>
                </a>
              {:else if mod.metadata.downloadUrl != null}
                <a
                  href={mod.metadata.downloadUrl}
                  target="_blank"
                  rel="noopener"
                  class="download"
                  on:click|stopPropagation
                >
                  <Icon
                    tag="svg"
                    viewBox="0 0 24 24"
                    style="width: 1.8rem; height: 1.8rem;"
                  >
                    <path fill="var(--color-link)" d={mdiMonitorArrowDown} />
                  </Icon>
                </a>
              {/if}
            {/if}
          </div>
        </Button>
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

    img {
      min-width: var(--img-size);
      min-height: var(--img-size);
      max-width: var(--img-size);
      max-height: var(--img-size);
      margin-right: 0.8rem;
    }

    .download {
      margin-left: 0.6rem;
      z-index: 100;
      padding: to-rem(2px);

      &:hover {
        background-color: rgba(13, 1, 46, 0.4);
        border-radius: to-rem(4px);
      }
    }
  }

  .wallet-name {
    display: flex;
    flex-direction: column;
    align-items: flex-start;

    .url {
      margin-top: 0.2rem;
      flex: 1 0 auto;
      font-size: 0.7rem;
      color: rgba(255, 255, 255, 0.7);
      height: 0.8rem;
    }
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
