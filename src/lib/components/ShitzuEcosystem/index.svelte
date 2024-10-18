<script lang="ts">
  import { page } from "$app/stores";
  import MEMECOOKING_LOGO from "$lib/assets/logo/meme-cooking.webp";

  const links = [
    { slug: "/stake", title: "Stake", icon: "i-mdi-lightning-bolt" },
    { slug: "/shitstars", title: "Shitstars", icon: "i-mdi-stars" },
    { slug: "/shitchat", title: "Shitchat", icon: "i-mdi-shield-key" },
    {
      slug: "https://shitzuapes.xyz/blog",
      title: "Blog",
      icon: "i-mdi-newspaper",
      external: true,
    },
    {
      slug: "https://meme.cooking",
      title: "MEME.COOKING",
      customLogo: MEMECOOKING_LOGO,
      external: true,
    },
    {
      slug: "https://github.com/Shitzu-Apes",
      title: "GitHub",
      icon: "i-simple-icons:github",
      color: "#181717",
      external: true,
      invert: true,
    },
    {
      slug: "https://x.com/shitzuonnear",
      title: "Twitter",
      icon: "i-simple-icons:x",
      color: "#000000",
      external: true,
      invert: true,
    },
    {
      slug: "https://t.me/Shitzu_Community",
      title: "Telegram",
      icon: "i-simple-icons:telegram",
      color: "#26A5E4",
      external: true,
    },
  ];

  $: pathname = $page.url.pathname;

  function isActive(slug: string): boolean {
    return slug === pathname;
  }
</script>

<div class="grid grid-cols-4 gap-2">
  {#each links as { slug, title, icon, customLogo, external, color, invert }}
    <a
      href={slug}
      class="flex flex-col items-center justify-center p-2 text-white no-underline hover:text-lime transition-colors"
      class:text-lime={isActive(slug)}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
    >
      {#if customLogo}
        <img src={customLogo} alt={title} class="size-6 mb-1 object-contain" />
      {:else if icon}
        {#if invert}
          <div
            class="size-6 mb-1 rounded flex items-center justify-center"
            style={color ? `background-color: ${color};` : ""}
          >
            <div class={`${icon} text-2xl text-white size-4`}></div>
          </div>
        {:else}
          <div
            class={`${icon} text-2xl mb-1 size-6`}
            style={color ? `color: ${color};` : ""}
          ></div>
        {/if}
      {/if}
      <span class="text-[10px] text-center">{title}</span>
    </a>
  {/each}
</div>
