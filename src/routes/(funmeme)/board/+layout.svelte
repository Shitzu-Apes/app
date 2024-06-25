<script lang="ts">
  import { BottomSheet } from "$lib/layout/BottomSheet";
  import FunmemeHeader from "$lib/layout/funmeme/FunmemeHeader.svelte";
</script>

<BottomSheet variant="funmeme" />
<div class="text-white min-h-screen">
  <FunmemeHeader />
  <main>
    <slot></slot>
  </main>
  <footer></footer>
</div>
