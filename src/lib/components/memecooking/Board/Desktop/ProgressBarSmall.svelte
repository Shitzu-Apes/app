<script lang="ts">
  import RadialProgressBar from "./RadialProgressBar.svelte";

  import type { Meme } from "$lib/api/client";
  import { createProgressBarData } from "$lib/util/progressBarLogic";

  export let meme: Meme;
  let props = createProgressBarData(meme);
  $: props = createProgressBarData(meme);
</script>

<div class="flex items-center gap-1">
  <div class="flex flex-col items-center">
    <div class="text-[10px] text-gray-400">progress</div>
    <div class="text-end w-full text-xs font-medium text-memecooking-400">
      {Math.round(props.progress * 100)}%
    </div>
  </div>

  <div class="w-14 h-fit flex items-center">
    <RadialProgressBar {meme} {props} />
  </div>
</div>
