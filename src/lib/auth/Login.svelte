<script lang="ts">
  import { createDropdownMenu, melt } from "@melt-ui/svelte";

  import { showWalletSelector } from ".";

  import { page } from "$app/stores";
  import { usePrimaryNftQuery } from "$lib/api/queries/rewarder";
  import { Button, Squircle } from "$lib/components";
  import { nearWallet } from "$lib/near";

  const accountId$ = nearWallet.accountId$;

  // Use the primary NFT query hook
  $: primaryNftQuery = usePrimaryNftQuery($accountId$ || "");

  const {
    elements: { menu, item, trigger },
  } = createDropdownMenu();

  $: isActive = $page.url.pathname === "/account";
</script>

<div class="login">
  {#if $accountId$}
    <div class="flex items-center gap-1">
      <a href="/account" class="size-8 text-lime flex items-center gap-2">
        <Squircle
          src={$primaryNftQuery.data
            ? `${import.meta.env.VITE_NFT_BASE_URL}/${$primaryNftQuery.data[0]}.png`
            : undefined}
          class={isActive ? "text-emerald" : "text-lime"}
        />
      </a>
      <button
        use:melt={$trigger}
        class="bg-lime hover:bg-lime/15 flex justify-center items-center decoration-none i-mdi:menu size-6"
      />
    </div>
  {:else}
    <Button
      onClick={() => {
        showWalletSelector();
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
        nearWallet.signOut();
      }}
      class="cursor-pointer hover:bg-lime/15 rounded-xl p-2"
    >
      Logout
    </div>
  </div>
</div>
