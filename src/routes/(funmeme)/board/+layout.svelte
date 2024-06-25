<script lang="ts">
  import "@unocss/reset/tailwind.css";
  import "virtual:uno.css";
  import { BottomSheet } from "$lib/layout/BottomSheet";
  import FunmemeHeader from "$lib/layout/funmeme/FunmemeHeader.svelte";
</script>

{#key "funmemeboard"}
  <BottomSheet variant="funmeme" />
  <div class="text-white min-h-screen">
    <FunmemeHeader />
    <main>
      <slot></slot>
    </main>
    <footer></footer>
  </div>
{/key}
