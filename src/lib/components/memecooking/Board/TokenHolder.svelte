<script lang="ts">
  import { onMount } from "svelte";

  import type { Meme } from "$lib/models/memecooking";
  import { MemeCooking } from "$lib/near";
  import { MCsubscribe, MCunsubscribe } from "$lib/store/memebids";
  import { FixedNumber } from "$lib/util";

  const percentFormatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  });

  export let meme: Meme;
  let holders: Promise<[string, number][] | null> = getHolders();

  function getHolders(): Promise<[string, number][] | null> {
    if (meme.pool_id) {
      const token_id = meme.token_id;
      return fetch(`https://api.fastnear.com/v1/ft/${token_id}/top`)
        .then((res) => res.json())
        .then(
          (data: {
            accounts: {
              account_id: string;
              balance: string;
            }[];
          }) => {
            return data.accounts.map((holder) => {
              const percentage =
                new FixedNumber(holder.balance, 24).toNumber() /
                new FixedNumber(meme.total_supply, 24).toNumber();
              return [holder.account_id, percentage];
            });
          },
        );
    } else {
      return MemeCooking.getMemeStakes(meme.meme_id, 0, 1000).then(
        (holders) => {
          if (!holders || holders.length === 0) {
            return null;
          }

          // sort from highest to lowest
          holders.sort((a, b) => (BigInt(b[1]) > BigInt(a[1]) ? 1 : -1));

          const holders_with_percentage = holders.map(([holder, amount]) => {
            const total_staked = new FixedNumber(
              meme.total_deposit,
              24,
            ).toNumber();
            const percentage =
              total_staked == 0
                ? 0
                : (new FixedNumber(amount, 24).toNumber() / total_staked) * 0.5;

            return [holder, percentage];
          });

          return [["pool", 0.5], ...holders_with_percentage] as [
            string,
            number,
          ][];
        },
      );
    }
  }

  const MCsymbol = Symbol();
  onMount(() => {
    MCsubscribe(MCsymbol, (newTrade) => {
      if (newTrade.meme_id !== meme.meme_id) {
        return;
      }

      holders = getHolders();
    });

    return () => {
      MCunsubscribe(MCsymbol);
    };
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
        {#each holders as holder (holder[0])}
          <div class="w-full flex justify-between items-center">
            <p class="w-1/2 overflow-hidden text-ellipsis">
              {holder[0]}
            </p>
            <p class="flex items-center">
              {percentFormatter.format(holder[1] * 100)}%
            </p>
          </div>
        {/each}
      </div>
    {/if}
  {/await}
</div>
