<script lang="ts">
  import { slide } from "svelte/transition";

  import { page } from "$app/stores";
  import paths from "$lib/paths";

  export let isTG: boolean;

  const icons: {
    [key in (typeof paths)[number]["slug"]]: string;
  } = {
    "/": "i-mdi-house",
    "/stake": "i-mdi-lightning-bolt",
  };

  $: pathname = $page.url.pathname;
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

  <nav transition:slide class="flex gap-3 px-3 py-3">
    {#each paths as { slug, title }}
      <a
        href={slug}
        class="border-lime px-3 py-1 rounded-full flex decoration-none"
        class:border-2={pathname === slug}
      >
        <div class={`${icons[slug]} w-6 h-6 mr-1`} />
        {title}
      </a>
    {/each}
  </nav>
</div>
