<script lang="ts">
  import { format } from "d3";

  import Near from "$lib/assets/Near.svelte";
  import SHITZU_ICON from "$lib/assets/logo/shitzu.webp";
  import { type PoolInfo } from "$lib/near";
  import { FixedNumber } from "$lib/util";

  export let poolInfo: PoolInfo;
  export let share: FixedNumber;

  const sharePerc = share.div(
    new FixedNumber(poolInfo.shares_total_supply, 24),
  );
  const shitzuAmount = sharePerc.mul(new FixedNumber(poolInfo.amounts[0], 18));
  const nearAmount = sharePerc.mul(new FixedNumber(poolInfo.amounts[1], 24));
</script>

<div class="w-full">
  <div class="font-600">
    <div class="text-end">
      {share.format()}
      ({format(".2%")(sharePerc.toNumber())})
    </div>

    <div class="flex flex-col gap-1 text-sm items-end">
      <div class="flex gap-1 items-center">
        <img src={SHITZU_ICON} alt="SHITZU" class="size-4" />
        {shitzuAmount.format()}
      </div>
      <div class="flex gap-1 items-center">
        <Near className="size-4 text-black bg-white rounded-full" />
        {nearAmount.format()}
      </div>
    </div>
  </div>
</div>
