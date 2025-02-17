<script lang="ts">
  import type { Meme } from "$lib/models/memecooking";
  import type { FixedNumber } from "$lib/util";
  import { calculateTokenStatsFromMeme } from "$lib/util/projectedMCap";

  export let memebid: Meme;
  export let nearPrice: FixedNumber;

  const { mcap, liquidity } = calculateTokenStatsFromMeme(memebid);
</script>

<div class="flex flex-col">
  <div class="flex items-center gap-1">
    <span class="text-memecooking-400">MC:</span>
    <span class="font-medium">
      ${mcap.mul(nearPrice).format({
        maximumFractionDigits: 3,
        notation: "compact",
      })}
    </span>
  </div>
  <div class="flex items-center gap-1">
    <span class="text-memecooking-400">L:</span>
    <span class="font-medium">
      ${liquidity.mul(nearPrice).format({
        maximumFractionDigits: 3,
        notation: "compact",
      })}
    </span>
  </div>
</div>
