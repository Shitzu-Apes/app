<script lang="ts">
  import Countdown from "../../Countdown.svelte";

  import SHITZU_POCKET from "$lib/assets/shitzu_pocket.svg";
  import type { MCMemeInfoWithReference } from "$lib/models/memecooking";
  import { FixedNumber } from "$lib/util";

  export let memebid: MCMemeInfoWithReference;
</script>

<a
  href="/meme/{memebid.id}"
  class="flex items-start justify-start w-full max-w-sm gap-3 p-2 border border-transparent hover:border-white cursor-pointer"
>
  <img src={memebid.image} alt={memebid.name} class="w-24 h-24" />
  <div class="flex flex-col items-start justify-start h-full gap-1">
    <div class="text-xs flex items-center gap-1">
      created by <img src={SHITZU_POCKET} alt="shitzu pocket" class="size-4" />
      {memebid.owner}
    </div>
    <div class="text-sm">
      {memebid.name}
      <span class="font-bold text-shitzu-4">${memebid.symbol}</span>
    </div>
    <div class="text-xs">{memebid.description}</div>

    <div class="flex flex-col gap-1">
      <span class="text-xs text-shitzu-4">
        <Countdown
          class="text-xs text-shitzu-4"
          to={memebid.end_timestamp_ms}
        />
      </span>
      <span class="text-xs bg-amber text-white px-2 rounded">
        {new FixedNumber(memebid.total_staked, 24).format()}
      </span>
    </div>
  </div></a
>
