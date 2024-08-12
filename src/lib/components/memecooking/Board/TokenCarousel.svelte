<script lang="ts">
  import {
    type EmblaCarouselType,
    type EmblaOptionsType,
  } from "embla-carousel";
  import embalaCarousel from "embla-carousel-svelte";
  import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures";
  import { createEventDispatcher, onMount } from "svelte";

  import TokenDetailCarousel from "./TokenDetailCarousel.svelte";

  import { page } from "$app/stores";
  import { requiredStake } from "$lib/near/memecooking";
  import { memebids$ } from "$lib/store/memebids";

  let emblaApi: EmblaCarouselType | undefined = undefined;
  let options: EmblaOptionsType = {
    axis: "y",
  };

  export let currentMemebidsIdx: number;

  const dispatch = createEventDispatcher();

  onMount(() => {
    if ($page.params.page !== "board") {
      setTimeout(() => {
        document.querySelector(".focus-element")?.scrollIntoView({});
        emblaApi?.scrollTo(currentMemebidsIdx, true);
      }, 0);
    }
  });

  function prev() {
    emblaApi?.scrollPrev();
  }

  function next() {
    emblaApi?.scrollNext();
  }

  let startScrollBackToTop = {
    value: false,
    mouseY: 0,
  };

  let mouseY = 0;
</script>

<svelte:window
  on:mousemove={(event) => {
    mouseY = event.clientY;
  }}
  on:keydown={(event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const focus = document.querySelector(".focus-element");

      const focusTop = focus?.getBoundingClientRect().top;

      if (focusTop !== 0) {
        document.querySelector(".focus-element")?.scrollIntoView({
          behavior: "smooth",
        });
        dispatch("select", 0);
      } else {
        next();
      }
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (emblaApi?.canScrollPrev()) {
        prev();
      } else {
        scrollTo({
          top: 0,
          behavior: "smooth",
        });
        dispatch("select", -1);
      }
    }
  }}
/>

{#await Promise.all([requiredStake, $memebids$])}
  <section>
    <div class="flex flex-col h-screen">
      <div class="flex-[0_0_100%] min-h-0">
        <div class="h-[70%]">
          <div
            class="flex-[0_0_100%] min-w-0 flex flex-col justify-center items-center h-full text-shitzu-4 gap-4"
          >
            <h2 class="flex text-2xl">
              <span class="text-shitzu-4"> -d -h -m -s </span>
            </h2>
            <div class="flex gap-4 items-center">
              <div class="loader size-24" />
              <div class="flex flex-col gap-2">
                <!-- Created by -->
                <div class="loader w-40 h-4" />
                <!-- MCap -->
                <div class="loader w-50 h-4" />
                <!-- replies -->
                <div class="loader w-20 h-2" />
                <!-- Ticker -->
                <div class="loader w-50 h-5" />
              </div>
            </div>
            <div class="flex flex-col w-full px-4">
              <h3 class="flex">Bonding Curve</h3>
              <div class="loader w-full h-6"></div>
            </div>
          </div>
        </div>
        <div
          class="w-full h-8 flex justify-evenly border-b bg-shitzu-4 text-black items-center"
        >
          {#each ["[detail]", "[chart]", "[trade]", "[holder]"] as tab (tab)}
            <button
              class="cursor-pointer border-r border-dark w-[33%] last:border-transparent"
            >
              {tab}
            </button>
          {/each}
        </div>

        <div
          class="h-[calc(30%-32px)] w-full flex justify-center items-center pb-4 px-6"
        ></div>
      </div>
    </div>
  </section>
{:then [requiredStake, memebids]}
  <div class="w-full max-w-lg mx-auto">
    <div
      class="overflow-hidden relative focus-element"
      use:embalaCarousel={{ options, plugins: [WheelGesturesPlugin()] }}
      on:emblaInit={(event) => {
        emblaApi = event.detail;

        emblaApi.on("pointerDown", (e) => {
          if (e.selectedScrollSnap() === 0 && !startScrollBackToTop.value) {
            startScrollBackToTop = {
              value: true,
              mouseY,
            };
          }
        });

        emblaApi.on("pointerUp", (e) => {
          if (
            startScrollBackToTop.mouseY > mouseY &&
            e.selectedScrollSnap() === 0
          ) {
            scrollTo({
              top: 0,
              behavior: "smooth",
            });
            dispatch("select", -1);
          }

          startScrollBackToTop = {
            value: false,
            mouseY: 0,
          };
        });

        emblaApi.on("select", () => {
          if (emblaApi) {
            dispatch("select", emblaApi.selectedScrollSnap());
          }
        });

        emblaApi.on("slidesChanged", () => {
          if (emblaApi) {
            dispatch("select", emblaApi.selectedScrollSnap());
          }
        });
      }}
    >
      <div class="flex flex-col h-screen">
        {#each memebids as memebid, i (memebid.meme_id)}
          <div class="flex-[0_0_100%] min-h-0">
            <TokenDetailCarousel
              focused={currentMemebidsIdx === i}
              {memebid}
              {requiredStake}
            />
          </div>
        {/each}
      </div>
    </div>
  </div>
{/await}
