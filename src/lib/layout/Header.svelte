<script lang="ts">
  import { page } from "$app/stores";
  import paths from "$lib/paths";

  const icons: {
    [key in (typeof paths)[number]["slug"]]: string;
  } = {
    "/": "i-mdi-house",
    "/stake": "i-mdi-lightning-bolt",
  };

  $: pathname = $page.url.pathname;
</script>

<div class="border-b-2 border-lime w-full">
  <div class="mx-auto max-w-lg">
    <div class="flex px-4 py-3 justify-between items-center">
      <a href={window.location.origin} class="novisit">
        <img class="w-8 h-8" src="/assets/favicon.ico" alt="logo" />
      </a>

      {#await import("$lib/auth") then { Login }}
        <Login />
      {/await}
    </div>

    <nav class="flex gap-3 px-3 pb-2">
      {#each paths as { slug, title }}
        <a
          href={slug}
          class="border-lime hover:bg-lime/15 px-3 py-1 rounded-full flex decoration-none items-center text-base {pathname ===
            slug && 'bg-lime bg-opacity-15'}"
          class:border-2={pathname === slug}
        >
          <div class={`${icons[slug]} size-6 mr-1`} />
          {title}
        </a>
      {/each}
    </nav>
  </div>
</div>
