<script lang="ts">
  import type { EmblaCarouselType } from "embla-carousel";
  import emblaCarouselSvelte from "embla-carousel-svelte";

  import { page } from "$app/stores";
  import COINGECKO_LOGO from "$lib/assets/logo/coingecko.png";
  import DEXSCREENER_LOGO from "$lib/assets/logo/dexscreener.png";
  import JUICY_LUCY_LOGO from "$lib/assets/logo/jlu.png";
  import MEMECOOKING_LOGO from "$lib/assets/logo/meme-cooking.webp";
  import PIKESPEAK_LOGO from "$lib/assets/logo/pikespeak.png";
  import REF_LOGO from "$lib/assets/logo/ref.png";
  import { NFT_LINKS } from "$lib/components/BuyNft.svelte";
  import DexscreenerSheet from "$lib/components/DexscreenerSheet.svelte";
  import { openBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";

  const links = [
    {
      slug: "https://meme.cooking",
      title: "MEME.COOKING",
      customLogo: MEMECOOKING_LOGO,
      external: true,
    },
    {
      slug: "https://juicylucy.ai/",
      title: "Juicy Lucy",
      customLogo: JUICY_LUCY_LOGO,
      external: true,
    },
    {
      slug: "https://pikespeak.ai/money/tokens/token.0xshitzu.near",
      title: "Pikespeak",
      customLogo: PIKESPEAK_LOGO,
      external: true,
    },
    {
      slug: "/stake",
      title: "Stake",
      icon: "i-mdi-lightning-bolt",
    },
    {
      slug: "https://shitzuapes.xyz/blog",
      title: "Blog",
      icon: "i-mdi-newspaper",
      external: true,
    },
    {
      slug: "https://t.me/Shitzu_Community",
      title: "Telegram",
      icon: "i-simple-icons:telegram",
      color: "#26A5E4",
      external: true,
    },
    {
      slug: "https://x.com/shitzuonnear",
      title: "Twitter",
      icon: "i-simple-icons:x",
      color: "#000000",
      external: true,
    },
    {
      slug: "#",
      title: "Dexscreener",
      customLogo: DEXSCREENER_LOGO,
      action: () => openBottomSheet(DexscreenerSheet, { pool_id: "4369" }, "l"),
    },
  ];

  const secondSlideLinks = [
    {
      slug: "https://www.coingecko.com/en/coins/shitzu",
      title: "Coingecko",
      customLogo: COINGECKO_LOGO,
      external: true,
    },
    {
      slug: "https://github.com/Shitzu-Apes",
      title: "GitHub",
      icon: "i-simple-icons:github",
      color: "#181717",
      external: true,
    },
    {
      slug: `${import.meta.env.VITE_REF_APP_URL}/meme`,
      title: "Meme Season",
      customLogo: REF_LOGO,
      external: true,
    },
    {
      slug: "/shitstars",
      title: "Shitstars",
      icon: "i-mdi-stars",
    },
    {
      slug: "/shitchat",
      title: "Shitchat",
      icon: "i-mdi:shield-key",
    },
  ];

  $: pathname = $page.url.pathname;

  function isActive(slug: string): boolean {
    return slug === pathname;
  }

  let currentSlide = 0;
  const totalSlides = 2;

  let emblaApi: EmblaCarouselType;

  function onInit(e: CustomEvent) {
    emblaApi = e.detail;
    emblaApi.on("select", () => {
      currentSlide = emblaApi.selectedScrollSnap();
    });
  }

  function scrollTo(index: number) {
    if (emblaApi) {
      emblaApi.scrollTo(index);
    }
  }
</script>

<div class="w-full flex-col">
  <div class="overflow-hidden" use:emblaCarouselSvelte on:emblaInit={onInit}>
    <div class="flex">
      <div class="grid grid-cols-4 gap-2 flex-[0_0_100%] min-w-0">
        {#each links as { slug, title, icon, customLogo, external, color, action }}
          {#if action}
            <button
              on:click={action}
              class="flex flex-col items-center justify-center p-2 text-white no-underline hover:text-lime transition-colors"
            >
              {#if customLogo}
                <img
                  src={customLogo}
                  alt={title}
                  class="size-6 mb-1 object-contain"
                />
              {:else if icon}
                <div
                  class="size-6 mb-1 rounded flex items-center justify-center"
                  style={color
                    ? `background-color: ${color};`
                    : "background-color: #84cc16;"}
                >
                  <div
                    class={`${icon} text-2xl ${color ? "text-white" : "text-black"} size-4`}
                  ></div>
                </div>
              {/if}
              <span class="text-[10px] text-center whitespace-nowrap"
                >{title}</span
              >
            </button>
          {:else}
            <a
              href={slug}
              class="flex flex-col items-center justify-center p-2 text-white no-underline hover:text-lime transition-colors"
              class:text-lime={isActive(slug)}
              target={external ? "_blank" : undefined}
              rel={external ? "noopener noreferrer" : undefined}
            >
              {#if customLogo}
                <img
                  src={customLogo}
                  alt={title}
                  class="size-6 mb-1 object-contain"
                />
              {:else if icon}
                <div
                  class="size-6 mb-1 rounded flex items-center justify-center"
                  style={color
                    ? `background-color: ${color};`
                    : "background-color: #84cc16;"}
                >
                  <div
                    class={`${icon} text-2xl ${color ? "text-white" : "text-black"} size-4`}
                  ></div>
                </div>
              {/if}
              <span class="text-[10px] text-center whitespace-nowrap"
                >{title}</span
              >
            </a>
          {/if}
        {/each}
      </div>
      <div class="grid grid-cols-4 gap-2 flex-[0_0_100%] min-w-0">
        {#each NFT_LINKS as { platform, logo, link }}
          <a
            href={link}
            class="flex flex-col items-center justify-center p-2 text-white no-underline hover:text-lime transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img src={logo} alt={platform} class="size-6 mb-1 object-contain" />
            <span class="text-[10px] text-center">{platform}</span>
          </a>
        {/each}
        {#each secondSlideLinks as { slug, title, icon, customLogo, external, color }}
          <a
            href={slug}
            class="flex flex-col items-center justify-center p-2 text-white no-underline hover:text-lime transition-colors"
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
          >
            {#if customLogo}
              <img
                src={customLogo}
                alt={title}
                class="size-6 mb-1 object-contain"
              />
            {:else if icon}
              <div
                class="size-6 mb-1 rounded flex items-center justify-center"
                style={color
                  ? `background-color: ${color};`
                  : "background-color: #84cc16;"}
              >
                <div
                  class={`${icon} text-2xl ${color ? "text-white" : "text-black"} size-4`}
                ></div>
              </div>
            {/if}
            <span class="text-[10px] text-center whitespace-nowrap"
              >{title}</span
            >
          </a>
        {/each}
      </div>
    </div>
  </div>
  <div class="flex justify-center mt-2 gap-1">
    {#each Array(totalSlides) as _, i}
      <button
        on:click={() => scrollTo(i)}
        class="size-2 flex items-center justify-center transition-colors duration-300 ease-in-out cursor-pointer"
      >
        <div
          class="size-1 rounded-full"
          class:bg-lime={currentSlide === i}
          class:bg-gray-400={currentSlide !== i}
        ></div>
      </button>
    {/each}
  </div>
</div>
