<script lang="ts">
  import type { colorVariant } from "$lib/models/variant";

  export let variant: colorVariant = "lime";
</script>

<div class="flex flex-col w-full h-full mx-auto justify-start items-center">
  <div class="h-15 w-full flex flex-col">
    <!-- heder slot -->

    <div class="flex-1 flex items-center">
      <slot name="header" />
    </div>
    <!-- Horizontal Line -->
    <hr
      class="w-full {variant === 'lime' ? 'border-lime' : 'border-shitzu-4'}"
    />
  </div>
  <div
    class="block w-full h-[calc(100%-3.75rem)] overflow-y-auto overscroll-contain noscrollbar"
  >
    <slot />
  </div>
</div>

<style scoped>
  .noscrollbar::-webkit-scrollbar {
    display: none;
  }

  .noscrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
</style>
