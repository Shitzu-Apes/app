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
  import type { MCMemeInfoWithReference } from "$lib/models/memecooking";

  let emblaApi: EmblaCarouselType | undefined = undefined;
  let options: EmblaOptionsType = {
    axis: "y",
  };

  export let memebids: MCMemeInfoWithReference[];

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
      {#each memebids as memebid, i (memebid.id)}
        <div class="flex-[0_0_100%] min-h-0">
          <TokenDetailCarousel
            focused={currentMemebidsIdx === i}
            id={i}
            {memebid}
          />
        </div>
      {/each}
    </div>
  </div>
</div>
