<script lang="ts">
  import RadialProgressBar from "./RadialProgressBar.svelte";

  import type { Meme } from "$lib/api/client";
  import { createProgressBarData } from "$lib/util/progressBarLogic";

  export let meme: Meme;
  let props = createProgressBarData(meme);
  $: props = createProgressBarData(meme);
</script>

<div class="flex items-center gap-1">
  <div
    class="flex items-center justify-center text-xs font-medium text-memecooking-400"
  >
    {Math.round(props.progress * 100)}%
  </div>

  <div class="w-10 h-fit flex items-center">
    <RadialProgressBar {meme} {props} />
  </div>
</div>
