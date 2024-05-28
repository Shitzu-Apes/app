<script lang="ts">
  import BurnTheShit from "./BurnTheShit.svelte";
  import TokenBalance from "./TokenBalance.svelte";

  import { Dogshit, Pool, wallet } from "$lib/near";

  const { accountId$ } = wallet;

  $: rewardsPromise = new Promise<
    Awaited<ReturnType<typeof Dogshit.simulateBurn>>
  >((resolve, reject) => {
    if (!$accountId$) {
      return reject("No account");
    }
    Pool.getUnclaimedReward($accountId$, 0)
      .then((balance) => {
        Dogshit.simulateBurn(balance.toString())
          .then((shares) => {
            resolve(shares);
          })
          .catch(reject);
      })
      .catch(reject);
  });
</script>

<h2 class="not-prose text-xl">Track $DOGSHIT</h2>
{#await rewardsPromise}
  <div class="i-svg-spinners:pulse-3 size-6" />
{:then rewards}
  <div
    class="not-prose w-full border-collapse border border-lime rounded-lg overflow-hidden"
  >
    <ul>
      {#each rewards as [reward, share]}
        <TokenBalance {reward} {share} />
      {/each}
      <li>
        <BurnTheShit
          class="w-full py-3 bg-lime text-black font-bold text-xl disabled:bg-gray-5 relative"
        >
          Claim & burn the 💩
        </BurnTheShit>
      </li>
    </ul>
  </div>
{/await}
