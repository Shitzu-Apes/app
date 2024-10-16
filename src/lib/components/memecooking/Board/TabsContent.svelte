<script lang="ts">
  import Terminal from "./Desktop/Terminal.svelte";

  let width: number;
</script>

<svelte:window bind:innerWidth={width} />

<div>
  <Terminal />
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
