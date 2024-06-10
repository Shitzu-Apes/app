<script lang="ts">
  import { createDropdownMenu, melt } from "@melt-ui/svelte";

  import { showWalletSelector } from ".";

  import { page } from "$app/stores";
  import { Button, Squircle } from "$lib/components";
  import { wallet } from "$lib/near";
  import { resolvedPrimaryNftTokenId, refreshPrimaryNftOf } from "$lib/store";

  const accountId$ = wallet.accountId$;

  const {
    elements: { menu, item, trigger },
  } = createDropdownMenu();

  $: isActive = $page.url.pathname === "/account";

  $: if ($accountId$) {
    refreshPrimaryNftOf($accountId$);
  }
</script>

<div class="login">
  {#if $accountId$}
    <!-- Donation Button -->
    <div class="flex items-center gap-1">
      <a
        href="/funmeme"
        class="bg-lime mr-2 px-3 py-0.5 rounded text-black decoration-none animate-shaking"
      >
        fun.meme
      </a>
      <a href="/account" class="size-8 text-lime flex items-center gap-2">
        <Squircle
          src={$resolvedPrimaryNftTokenId
            ? `${import.meta.env.VITE_NFT_BASE_URL}/${$resolvedPrimaryNftTokenId.token_id}.png`
            : undefined}
          class={isActive ? "text-emerald" : "text-lime"}
        />
      </a>
      {#if !wallet.isTG}
        <button
          use:melt={$trigger}
          class="bg-lime hover:bg-lime/15 flex justify-center items-center decoration-none i-mdi:menu size-6"
        />
      {/if}
    </div>
  {:else}
    <Button
      onClick={() => {
        if (wallet.isTG) {
          wallet.loginViaHere();
        } else {
          showWalletSelector();
        }
      }}
      type="secondary"
    >
      Connect
    </Button>
  {/if}

  <div
    use:melt={$menu}
    class="flex flex-col gap-2 bg-black text-white border-2 border-lime px-4 py-2 rounded-xl"
  >
    <a use:melt={$item} href="/account" class="hover:bg-lime/15 rounded-xl p-2">
      Show account
    </a>
    <div
      use:melt={$item}
      on:m-click={() => {
        wallet.signOut();
      }}
      class="cursor-pointer hover:bg-lime/15 rounded-xl p-2"
    >
      Logout
    </div>
  </div>
</div>

<style scoped>
  .animate-shaking {
    animation: shake 750ms linear infinite;
  }

  @keyframes shake {
    0%,
    100% {
      transform: translate3d(0, 0, 0);
    }
    10%,
    30% {
      transform: translate3d(-10px, 0, 0);
    }
    20%,
    40% {
      transform: translate3d(10px, 0, 0);
    }
    50%,
    60% {
      transform: translate3d(0, 0, 0);
    }
    70%,
    90% {
      transform: translate3d(-10px, 0, 0);
    }
    80% {
      transform: translate3d(10px, 0, 0);
    }
  }
</style>
