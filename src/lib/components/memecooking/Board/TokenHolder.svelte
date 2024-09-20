<script lang="ts">
  import { onMount } from "svelte";

  import Tooltip from "$lib/components/Tooltip.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { MemeCooking } from "$lib/near/memecooking";
  import { MCTradeSubscribe, MCunsubscribe } from "$lib/store/memebids";
  import { FixedNumber } from "$lib/util";

  export let meme: Meme;
  let holders: ReturnType<typeof getHolders> = new Promise<never>(() => {});

  getHolders();
  function getHolders() {
    const res = fetchHolders().then((holders) =>
      holders != null
        ? holders
            .map(
              ([account, percentage]) =>
                [
                  account,
                  percentage.format({
                    maximumFractionDigits: 2,
                  }),
                ] as [string, string],
            )
            .filter(([_, percentage]) => percentage !== "0")
        : null,
    );
    holders = res;
    return res;
  }

  function fetchHolders(): Promise<[string, FixedNumber][] | null> {
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
              const percentage = new FixedNumber(holder.balance, 24)
                .div(new FixedNumber(meme.total_supply, 24))
                .mul(new FixedNumber(100n, 0));
              return [holder.account_id, percentage] as [string, FixedNumber];
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
              BigInt(meme.total_deposit) - BigInt(meme.total_withdraw_fees),
              24,
            );
            const percentage =
              total_staked.valueOf() === 0n
                ? total_staked
                : new FixedNumber(amount, 24)
                    .div(total_staked)
                    .div(new FixedNumber(2n, 0))
                    .mul(new FixedNumber(100n, 0));

            return [holder, percentage];
          });

          return [
            ["pool", new FixedNumber(50n, 0)],
            ...holders_with_percentage,
          ] as [string, FixedNumber][];
        },
      );
    }
  }

  const MCsymbol = Symbol();
  onMount(() => {
    MCTradeSubscribe(MCsymbol, (newTrade) => {
      if (newTrade.meme_id !== meme.meme_id) {
        return;
      }
      getHolders();
    });

    return () => {
      MCunsubscribe(MCsymbol);
    };
  });
</script>

<div class="w-full px-4 max-h-[30rem] md:max-h-none overflow-auto">
  <h2 class="text-xl my-3 flex items-center gap-1">
    Holders

    <Tooltip>
      <slot slot="info">
        <div class="px-4 py-1">
          Prelaunch: depositors distribution
          <br />
          Successfully launched: actual list of current holders
        </div>
      </slot>
      <div class="i-mdi:information-outline" />
    </Tooltip>
  </h2>

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
              {holder[1]}%
            </p>
          </div>
        {/each}
      </div>
    {/if}
  {/await}
</div>
