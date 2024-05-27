<script lang="ts">
  import { Dogshit, Pool, wallet } from "$lib/near";
  import { getToken$ } from "$lib/store";
  import TokenBalance from "./TokenBalance.svelte";

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

<h2>Manage Your $DOGSHIT</h2>
{#await rewardsPromise}
  <div class="i-svg-spinners:pulse-3 size-6" />
{:then rewards}
  <div class="w-full overflow-x-auto">
    <table
      class="not-prose w-full max-w-full border-collapse border border-lime rounded-lg"
    >
      <thead>
        <tr>
          <th class="border border-lime px-4 py-2">Token</th>
          <th class="border border-lime px-4 py-2">Claimable</th>
        </tr>
      </thead>
      <tbody>
        {#each rewards as [reward, share]}
          <TokenBalance {reward} {share} />
        {/each}
      </tbody>
    </table>
  </div>
{/await}
