<script lang="ts">
  import "@unocss/reset/tailwind.css";
  import "virtual:uno.css";

  import { cubicIn, cubicOut } from "svelte/easing";
  import { blur } from "svelte/transition";

  import MCHeader from "$lib/layout/memecooking/MCHeader.svelte";
</script>

{#key "memecooking"}
  <div
    in:blur={{ duration: 500, delay: 500, easing: cubicIn }}
    out:blur={{ duration: 500, easing: cubicOut }}
    class="w-full h-screen bg-dark"
  >
    <div class="text-white min-h-screen">
      <MCHeader />
      <slot />
    </div>
  </div>
{/key}
