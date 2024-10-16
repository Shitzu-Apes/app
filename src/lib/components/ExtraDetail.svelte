<script lang="ts">
  import type { Meme } from "$lib/models/memecooking";
  import { FixedNumber } from "$lib/util";

  export let meme: Meme;

  let className: string = "";
  export { className as class };

  const softCap = new FixedNumber(meme.soft_cap ?? "0", 24);
  const hardCap = new FixedNumber(meme.hard_cap ?? "0", 24);
  const hardCapEnabled = meme.hard_cap && BigInt(meme.hard_cap) > 0;

  const FULL_COPY = `
  The total supply of ${meme.symbol} is ${new FixedNumber(
    meme.total_supply,
    meme.decimals,
  ).format()}. Half of this supply, plus ${new FixedNumber(
    meme.total_deposit,
    24,
  ).format()} NEAR, will be used for liquidity and burned. The remaining half will
  be shared among depositors. The Soft Cap of ${softCap.format()} NEAR is
  the minimum required to launch on ref once the duration is over. 
    ${hardCapEnabled ? `If the Hard Cap of ${hardCap.format()} NEAR is reached, it will trigger an immediate launch.` : ""}
  `;
</script>

<div class="{className} overflow-hidden">
  <div>
    {FULL_COPY}
  </div>
</div>
