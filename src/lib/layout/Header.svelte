<script lang="ts">
  import Button from "@smui/button";
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

<div class="border-b-2 border-lime">
  <div class="flex px-4 py-3 justify-between">
    <a href={window.location.origin} class="novisit">
      <img class="w-8 h-8" src="/favicon.ico" alt="logo" />
    </a>

    {#await import("$lib/auth") then { Login }}
      <Login {isTG} />
    {/await}
  </div>

  <!-- <button
    class="w-6 h-6"
    class:i-mdi-menu={showMenu}
    class:i-mdi-menu-close={!showMenu}
    on:click={() => {
      showMenu = !showMenu;
    }}
  /> -->

  <nav transition:slide class="flex gap-3 px-3 py-3">
    <a
      href="/"
      class="border-lime px-3 py-1 rounded-full flex decoration-none"
      class:border-2={$path$ === "/"}
    >
      <div class="i-mdi-house w-6 h-6 mr-1" />
      Home
    </a>
    <a
      href="/stake"
      class="border-lime px-3 py-1 rounded-full flex decoration-none"
      class:border-2={$path$ === "/stake"}
    >
      <div class="i-mdi-lightning-bolt w-6 h-6 mr-1" />
      Stake
    </a>
  </nav>
</div>
