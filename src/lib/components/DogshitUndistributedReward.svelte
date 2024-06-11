<script lang="ts">
  import BurnTheShit from "./BurnTheShit.svelte";
  import TokenBalance from "./TokenBalance.svelte";

  import { BottomSheetContent } from "$lib/layout/BottomSheet";
  import { Dogshit, Pool, wallet } from "$lib/near";
  import { getTokenSortIndex } from "$lib/store";

  const { accountId$ } = wallet;

  let rewardsPromise: Promise<Awaited<ReturnType<typeof Dogshit.simulateBurn>>>;

  refreshRewards();

  function refreshRewards() {
    rewardsPromise = new Promise<
      Awaited<ReturnType<typeof Dogshit.simulateBurn>>
    >((resolve, reject) => {
      if (!$accountId$) {
        return reject("No account");
      }
      Pool.getUnclaimedReward($accountId$, 0)
        .then((balance) => Dogshit.simulateBurn(balance.toString()))
        .then((shares) => {
          shares.sort(
            (a, b) => getTokenSortIndex(b[0]) - getTokenSortIndex(a[0]),
          );
          resolve(shares);
        })
        .catch(reject);
    });
  }
</script>

<BottomSheetContent>
  <slot slot="header">
    <h1 class="text-xl text-lime mr-auto mx-3">Track $DOGSHIT</h1>
  </slot>

  {#await rewardsPromise}
    <div class="w-full h-full flex items-center justify-center">
      <div class="i-svg-spinners:pulse-3 size-20 text-lime" />
    </div>
  {:then rewards}
    <ul class="w-full">
      {#each rewards as [reward, share]}
        <TokenBalance {reward} {share} />
      {/each}
      <li>
        <BurnTheShit
          class="w-full py-3 rounded-none"
          on:claimSuccess={refreshRewards}
        >
          Claim & burn the 💩
        </BurnTheShit>
      </li>
    </ul>
  {/await}
</BottomSheetContent>
