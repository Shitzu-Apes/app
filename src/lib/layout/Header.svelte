<script lang="ts">
  import { mdiMenu, mdiMenuClose } from "@mdi/js";
  import Button from "@smui/button";
  import IconButton, { Icon } from "@smui/icon-button";
  import { writable } from "svelte/store";
  import { slide } from "svelte/transition";

  import { navigating } from "$app/stores";
  import { showWalletSelector } from "$lib/auth";
  import { wallet } from "$lib/near";

  export let isTG: boolean;

  let showMenu = false;
  let showAccountMenu$ = writable(false);
  let path$ = writable(window.location.pathname);

  const accountId$ = wallet.accountId$;

  $: if (showMenu) {
    $showAccountMenu$ = false;
  }
  showAccountMenu$.subscribe((show) => {
    if (show) {
      showMenu = false;
    }
  });

  navigating.subscribe(() => {
    $path$ = window.location.pathname;
    showMenu = false;
    $showAccountMenu$ = false;
  });
</script>

<div class="header">
  <a href={window.location.origin} class="novisit">
    <img style="height: 2rem;" src="/favicon.ico" alt="logo" />
    <h1>Shitzu App</h1>
  </a>

  {#await import("$lib/auth") then { Login }}
    <Login {showAccountMenu$} />
  {/await}

  <IconButton
    size="button"
    class="material-icons"
    on:click={() => {
      showMenu = !showMenu;
    }}
  >
    {#if showMenu}
      <Icon tag="svg" viewBox="0 0 24 24">
        <path fill="currentColor" d={mdiMenuClose} />
      </Icon>
    {:else}
      <Icon tag="svg" viewBox="0 0 24 24">
        <path fill="currentColor" d={mdiMenu} />
      </Icon>
    {/if}
  </IconButton>

  {#if showMenu}
    <nav transition:slide>
      {#if $path$ === "/"}
        <Button class="mdc-button__nav-link" variant="raised" disabled>
          Home
        </Button>
      {:else}
        <Button class="mdc-button__nav-link" href="/" variant="outlined">
          Home
        </Button>
      {/if}
      {#if $path$ === "/stake"}
        <Button class="mdc-button__nav-link" variant="raised" disabled>
          Stake
        </Button>
      {:else}
        <Button class="mdc-button__nav-link" href="/stake" variant="outlined">
          Stake
        </Button>
      {/if}
    </nav>
  {/if}

  {#if $showAccountMenu$}
    <nav transition:slide>
      {#if $accountId$}
        {#if $path$ === "/account"}
          <Button class="mdc-button__nav-link" variant="raised" disabled>
            {$accountId$}
          </Button>
        {:else}
          <Button
            class="mdc-button__nav-link"
            href="/account"
            variant="outlined"
          >
            {$accountId$}
          </Button>
        {/if}

        <Button color="secondary" variant="outlined" on:click={wallet.signOut}>
          Logout
        </Button>
      {:else}
        <Button
          variant="outlined"
          on:click={isTG ? wallet.loginViaHere : showWalletSelector}
        >
          Login
        </Button>
      {/if}
    </nav>
  {/if}
</div>

<style lang="scss">
  .header {
    display: flex;
    align-items: center;
    justify-content: end;
    flex-wrap: wrap;
    padding: 0.4rem 0.8rem;
    min-height: 3.5rem;
    flex: 0 0 auto;
    gap: 1.4rem;
    background-color: var(--color-light-green-transparent);

    > :first-child {
      flex: 1 1 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.8rem;
    }
  }

  h1 {
    text-align: center;

    @include breakpoint(mobile, max) {
      font-size: 1.6rem;

      @include breakpoint(phone, max) {
        display: none;
      }
    }
  }

  nav {
    width: 100vw;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    align-items: center;
    font-size: 1.2rem;

    :global(.mdc-button__nav-link) {
      width: 15rem;
      max-width: 15rem;
      color: unset;
      text-align: center;

      &:hover {
        background-color: var(--color-light-green-transparent);
      }

      &:disabled {
        background-color: var(--color-light-green-transparent-2);
      }
    }
  }
</style>
