<script lang="ts">
  import Terminal from "./Desktop/Terminal.svelte";
  import TokenCarousel from "./TokenCarousel.svelte";

  let width: number;
</script>

<svelte:window bind:innerWidth={width} />

<div class="mobile">
  {#if width <= 768}
    <TokenCarousel />
  {/if}
</div>
<div class="desktop">
  {#if width > 768}
    <Terminal />
  {/if}
</div>

<style lang="scss">
  .mobile {
    display: none;
  }
  .desktop {
    display: contents;
  }

  @include breakpoint(mobile, max) {
    .mobile {
      display: contents;
    }
    .desktop {
      display: none;
    }
  }
</style>
