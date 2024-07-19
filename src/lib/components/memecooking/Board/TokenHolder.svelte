<script lang="ts">
  import type { MCMemeInfoWithReference } from "$lib/models/memecooking";
  import { MemeCooking } from "$lib/near";
  import { FixedNumber } from "$lib/util";

  // let holders = [...new Array(20).keys()];
  export let meme: MCMemeInfoWithReference;
  let holders: Promise<[string, number][] | null> = MemeCooking.getMemeStakes(
    meme.id,
    0,
    1000,
  ).then((holders) => {
    if (!holders || holders.length === 0) {
      return null;
    }

    // sort from highest to lowest
    holders.sort((a, b) => (BigInt(b[1]) > BigInt(a[1]) ? 1 : -1));

    return holders.map(([holder, amount]) => {
      const percentage =
        (new FixedNumber(amount, 24).toNumber() /
          new FixedNumber(meme.total_staked, 24).toNumber()) *
        0.5;
      return [holder, percentage];
    });
  });
</script>

<div class="w-full px-4">
  <h2 class="text-xl my-3">Holders</h2>
  {#await holders}
    <div class="loader w-40 h-4" />
  {:then holders}
    {#if holders === null || holders.length === 0}
      <p>No holders</p>
    {:else}
      <div class="w-full h-full flex flex-col gap-2 items-center">
        <div class="w-full flex justify-between items-center">
          <p class="w-1/2 overflow-hidden text-ellipsis">pool</p>
          <p class="flex items-center">50%</p>
        </div>
        {#each holders as holder (holder)}
          <div class="w-full flex justify-between items-center">
            <p class="w-1/2 overflow-hidden text-ellipsis">
              {holder[0]}
            </p>
            <p class="flex items-center">
              {holder[1] * 100}%
            </p>
          </div>
        {/each}
      </div>
    {/if}
  {/await}
  <!-- <div class="w-full h-full flex flex-col gap-2 items-center">
    {#each holders as holder (holder)}
      <div class="w-full flex justify-between items-center">
        <p>
          {holder + 1}. random
        </p>
        <p>5%</p>
      </div>
    {/each}
  </div>-->
</div>
