<script lang="ts">
  import Claim from "./Claim.svelte";
  import RefLpInfo from "./RefLPInfo.svelte";

  import { LPFarm, Ref, MemeSeason, nearWallet } from "$lib/near";
  import { FixedNumber } from "$lib/util";

  const { accountId$ } = nearWallet;

  $: RefShitzuNearPool = Ref.getPool(4369);

  $: lpFarm = new Promise((resolve, reject) => {
    if (!$accountId$) {
      reject();
      return;
    }
    LPFarm.getFarmerSeed($accountId$, "v2.ref-finance.near@4369").then(
      (seed) => {
        if (seed) {
          resolve(new FixedNumber(seed.free_amount, 24));
        } else {
          resolve(new FixedNumber("0", 24));
        }
      },
    );
  }) as Promise<FixedNumber>;

  $: checkpointMilliSec = new Promise((resolve) => {
    if (!$accountId$) {
      resolve(undefined);
      return;
    }

    MemeSeason.getUserCheckpoint($accountId$).then((checkpoint) => {
      if (checkpoint) {
        resolve(~~(+checkpoint / 1_000_000_000));
      } else {
        resolve(null);
      }
    });
  }) as Promise<number | null | undefined>;

  $: claimable = lpFarm.then((lp) => {
    const lp_shitstars =
      lp.toNumber() === 0
        ? 0
        : Math.min(200, 100 + Math.sqrt(lp.toNumber()) / 0.005);

    return lp_shitstars;
  });
</script>

<section>
  <div
    class="bg-gradient-to-t bg-gradient-from-[#0f687f] bg-gradient-to-[#18546d] text-light rounded-xl py-4 px-3 not-prose"
  >
    <div class="w-full min-h-16">
      <div class="w-full flex justify-between">
        <div>
          <h3 class="flex items-center text-lg">LP</h3>
          <a
            href="{import.meta.env.VITE_REF_APP_URL}/v2farms/4369-r"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center text-sm text-gray-300"
          >
            Participate
            <div class="i-mdi:arrow-top-right size-4" /></a
          >
        </div>
        {#await Promise.all([lpFarm, RefShitzuNearPool])}
          <div class="i-svg-spinners:pulse" />
        {:then [lpShare, poolInfo]}
          <RefLpInfo {poolInfo} share={lpShare} />
        {/await}
      </div>
      {#await Promise.all([checkpointMilliSec, claimable])}
        <div
          class="w-full h-12 py-3 bg-coolgray text-lime rounded-lg mt-6 animate-pulse"
        />
      {:then [checkpoint, claimable]}
        {#if checkpoint !== undefined}
          <Claim
            on:claimed={() => {
              checkpointMilliSec = new Promise((resolve) => {
                const newCheckpoint = ~~(new Date().getTime() / 1000);
                resolve(newCheckpoint);
              });
            }}
            {checkpoint}
            {claimable}
          />
        {:else}
          <div
            class="w-full h-12 py-3 bg-coolgray text-lime rounded-lg mt-6 animate-pulse"
          />
        {/if}
      {/await}
    </div>
  </div>
</section>
