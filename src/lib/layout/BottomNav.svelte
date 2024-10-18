<script lang="ts">
  import { page } from "$app/stores";
  import { showWalletSelector } from "$lib/auth/showWalletSelector";
  import Squircle from "$lib/components/Squircle.svelte";
  import { wallet } from "$lib/near";
  import paths from "$lib/paths";
  import { resolvedPrimaryNftTokenId, refreshPrimaryNftOf } from "$lib/store";

  const accountId$ = wallet.accountId$;

  const icons: {
    [key in (typeof paths)[number]["slug"]]: string;
  } = {
    "/": "i-mdi-house",
    "/stake": "i-mdi-lightning-bolt",
    "/shitstars": "i-mdi-stars",
    "/shitchat": "i-mdi:shield-key",
  };

  $: pathname = $page.url.pathname;

  $: if ($accountId$) {
    refreshPrimaryNftOf($accountId$);
  }

  function handleAccountClick() {
    if (!$accountId$) {
      showWalletSelector();
    }
  }
</script>

<nav class="fixed bottom-0 left-0 right-0 bg-[#222] border-t border-lime">
  <div class="flex justify-between items-stretch max-w-lg mx-auto">
    {#each paths as { slug, title }}
      <a
        href={slug}
        class="flex flex-col items-center py-2 px-1 flex-grow basis-0 {pathname ===
        slug
          ? 'text-lime'
          : 'text-white'} no-underline"
      >
        <div class={`${icons[slug]} size-6 text-current`} />
        <span
          class="text-[10px] mt-0.5 text-current font-300 truncate w-full text-center"
          >{title}</span
        >
      </a>
    {/each}
    {#if $accountId$}
      <a
        href="/account"
        class="flex flex-col items-center py-2 px-1 flex-grow basis-0 overflow-hidden {pathname ===
        '/account'
          ? 'text-lime'
          : 'text-white'} no-underline"
      >
        <Squircle
          src={$resolvedPrimaryNftTokenId
            ? `${import.meta.env.VITE_NFT_BASE_URL}/${$resolvedPrimaryNftTokenId.token_id}.png`
            : undefined}
          class="size-6 text-current"
        />
        <span
          class="text-[10px] mt-0.5 text-current font-300 truncate w-full text-center"
        >
          {$accountId$}
        </span>
      </a>
    {:else}
      <button
        on:click={handleAccountClick}
        class="flex flex-col items-center py-2 px-1 flex-grow basis-0 {pathname ===
        '/account'
          ? 'text-lime'
          : 'text-white'} no-underline bg-transparent border-none cursor-pointer"
      >
        <div class="i-mdi:account size-6 text-current" />
        <span
          class="text-[10px] mt-0.5 text-current font-300 truncate w-full text-center"
          >Account</span
        >
      </button>
    {/if}
  </div>
</nav>
