<script lang="ts">
  import { page } from "$app/stores";
  import paths from "$lib/paths";

  const icons: {
    [key in (typeof paths)[number]["slug"]]: string;
  } = {
    "/": "i-mdi-house",
    "/stake": "i-mdi-lightning-bolt",
    "/shitstars": "i-mdi-stars",
  };

  $: pathname = $page.url.pathname;
</script>

<div class="border-b-2 border-lime w-full">
  <div class="mx-auto max-w-lg w-full">
    <div class="flex px-4 py-3 items-center w-full">
      <a href={window.location.origin} class="novisit flex-grow basis-0">
        <img class="w-8 h-8" src="/assets/favicon.ico" alt="logo" />
      </a>

      <a
        href="https://meme.cooking"
        target="_blank"
        rel="noopener"
        class="bg-lime mr-2 px-3 py-0.5 rounded text-black decoration-none animate-shaking"
      >
        meme.cooking
      </a>
      <div class="flex-grow basis-0 flex justify-end">
        {#await import("$lib/auth") then { Login }}
          <Login />
        {/await}
      </div>
    </div>

    <nav class="flex gap-3 px-3 pb-2 overflow-x-auto">
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
