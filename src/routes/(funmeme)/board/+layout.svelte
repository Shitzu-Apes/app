<script lang="ts">
  import "@unocss/reset/tailwind.css";
  import "virtual:uno.css";
  import FunmemeHeader from "$lib/layout/funmeme/FunmemeHeader.svelte";
</script>

<div class="text-white min-h-screen">
  <FunmemeHeader />
  <main>
    <slot></slot>
  </main>
  <footer></footer>
</div>
