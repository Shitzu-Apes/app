<script lang="ts">
  import "@unocss/reset/tailwind.css";
  import "virtual:uno.css";

  import { cubicIn, cubicOut } from "svelte/easing";
  import { blur } from "svelte/transition";
</script>

{#key "funmeme"}
  <div
    in:blur={{ duration: 500, delay: 500, easing: cubicIn }}
    out:blur={{ duration: 500, easing: cubicOut }}
    class="w-full h-screen bg-gradient-to-t bg-gradient-from-cyan bg-gradient-to-blue"
  >
    <slot />
  </div>
{/key}
