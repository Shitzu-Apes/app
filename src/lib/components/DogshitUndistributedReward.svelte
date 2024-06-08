<script lang="ts">
  import BurnTheShit from "./BurnTheShit.svelte";
  import TokenBalance from "./TokenBalance.svelte";

  import { Dogshit, Pool, wallet } from "$lib/near";
  import { getTokenSortIndex } from "$lib/store";

  const { accountId$ } = wallet;

  $: rewardsPromise = new Promise<
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
</script>

<div class="flex flex-col w-full h-full mx-auto justify-start items-center">
  <h1 class="text-xl text-lime mr-auto mx-3">Track $DOGSHIT</h1>
  {#await rewardsPromise}
    <div class="i-svg-spinners:pulse-3 size-6" />
  {:then rewards}
    <ul class="overflow-y-scroll block w-full">
      {#each rewards as [reward, share]}
        <TokenBalance {reward} {share} />
      {/each}
      <li>
        <BurnTheShit class="w-full py-3 rounded-none">
          Claim & burn the 💩
        </BurnTheShit>
      </li>
    </ul>
  {/await}
</div>
