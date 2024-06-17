<script lang="ts">
  import RefLpInfo from "./RefLPInfo.svelte";

  import SHITZU_ICON from "$lib/assets/logo/shitzu.webp";
  import XREF_ICON from "$lib/assets/logo/xref.svg";
  import { MemeFarmXRefShitzu, MemeFarmShitzu, LPFarm, Ref } from "$lib/near";
  import { wallet } from "$lib/near";
  import { FixedNumber } from "$lib/util";

  const { accountId$ } = wallet;

  $: xRefStaked = new Promise((resolve, reject) => {
    if (!$accountId$) {
      reject();
      return;
    }
    MemeFarmXRefShitzu.listFarmerSeeds($accountId$).then((seed) => {
      if ("xtoken.ref-finance.near" in seed) {
        resolve(
          new FixedNumber(seed["xtoken.ref-finance.near"].free_amount, 18),
        );
      }
    });
  }) as Promise<FixedNumber>;

  $: shitzuStaked = new Promise((resolve, reject) => {
    if (!$accountId$) {
      reject();
      return;
    }
    MemeFarmShitzu.listFarmerSeeds($accountId$).then((seed) => {
      if ("token.0xshitzu.near" in seed) {
        resolve(new FixedNumber(seed["token.0xshitzu.near"].free_amount, 18));
      }
    });
  }) as Promise<FixedNumber>;

  $: RefShitzuNearPool = Ref.getPool(4369);

  $: lpFarm = new Promise((resolve, reject) => {
    if (!$accountId$) {
      reject();
      return;
    }
    LPFarm.listFarmerSeeds($accountId$).then((seed) => {
      if ("v2.ref-finance.near@4369" in seed) {
        resolve(
          new FixedNumber(seed["v2.ref-finance.near@4369"].free_amount, 24),
        );
      }
    });
  }) as Promise<FixedNumber>;
</script>

<section>
  <h2>Ref Finance</h2>

  <div
    class="bg-gradient-to-r bg-gradient-from-lime bg-gradient-to-emerald text-black rounded-xl py-4 px-3 not-prose"
  >
    <div class="w-full flex justify-between">
      <h3>Staked</h3>
      {#await xRefStaked}
        <div class="i-svg-spinners:pulse" />
      {:then value}
        <div class="font-600 flex items-center gap-1">
          <img src={XREF_ICON} alt="XREF" class="size-5" />
          {value.format()}
        </div>
      {/await}
    </div>
    <div class="w-full flex justify-between mb-4">
      <div />
      {#await shitzuStaked}
        <div class="i-svg-spinners:pulse" />
      {:then value}
        <div class="font-600 flex items-center gap-1">
          <img src={SHITZU_ICON} alt="SHITZU" class="size-5" />
          {value.format()}
        </div>
      {/await}
    </div>
    <div class="w-full min-h-16">
      {#await Promise.all([lpFarm, RefShitzuNearPool])}
        <div class="i-svg-spinners:pulse" />
      {:then [lpShare, poolInfo]}
        <RefLpInfo {poolInfo} share={lpShare} />
      {/await}
    </div>
    <!-- <button class="w-full py-3 bg-dark text-lime rounded-lg mt-6">
      Shitstars available in 6h 30m 20s
    </button> -->
  </div>
</section>
