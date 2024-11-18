<script lang="ts">
  import { onMount } from "svelte";

  import SHITZU_POCKET from "$lib/assets/shitzu_pocket.svg";
  import SHITZU_STONK from "$lib/assets/static/shitzu_stonk.png";
  import Tooltip from "$lib/components/Tooltip.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { MemeCooking } from "$lib/near/memecooking";
  import { MCTradeSubscribe, MCunsubscribe } from "$lib/store/MCWebSocket";
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
      return fetch(`${import.meta.env.VITE_FASTNEAR_API}/v1/ft/${token_id}/top`)
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

          const total_staked = new FixedNumber(
            BigInt(meme.total_deposit ?? "0"),
            24,
          );
          const delta = 1 / 1.98; // Same as VestingChart

          // Calculate team allocation percentage with 2 decimal precision
          const team_allocation_percentage =
            BigInt(meme.team_allocation ?? "0") > 0n &&
            BigInt(meme.total_supply ?? "0") > 0n
              ? Number(
                  (BigInt(meme.team_allocation ?? "0") /
                    BigInt(meme.total_supply ?? "0")) *
                    100n,
                )
              : 0;

          // Calculate pool and depositor percentages based on delta with 2 decimal precision
          const remaining_percentage = Number(
            (100 - team_allocation_percentage).toFixed(2),
          );
          const pool_percentage = Number(
            (remaining_percentage * delta).toFixed(2),
          );
          const depositor_percentage = Number(
            (remaining_percentage * (1 - delta)).toFixed(2),
          );

          const holders_with_percentage = holders.map(([holder, amount]) => {
            const percentage =
              total_staked.valueOf() === 0n
                ? total_staked
                : new FixedNumber(amount, 24)
                    .div(total_staked)
                    .mul(
                      new FixedNumber(
                        BigInt(Math.round(depositor_percentage * 100)),
                        2,
                      ),
                    );

            return [holder, percentage];
          });

          let result: [string, FixedNumber][] = [
            [
              "pool",
              new FixedNumber(BigInt(Math.round(pool_percentage * 100)), 2),
            ],
          ];

          // Add team allocation if it exists
          if (team_allocation_percentage > 0) {
            result.push([
              "team",
              new FixedNumber(
                BigInt(Math.round(team_allocation_percentage * 100)),
                2,
              ),
            ]);
          }

          return [...result, ...holders_with_percentage] as [
            string,
            FixedNumber,
          ][];
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

<div class="w-full">
  <div class="">
    <h2 class="text-lg font-medium mb-3 flex items-center gap-2 text-shitzu-4">
      <img src={SHITZU_STONK} alt="Shitzu Stonk" class="size-10" />
      Top 100 Holders
      <Tooltip>
        <slot slot="info">
          <div class="px-3 py-2 text-sm">
            <p>Prelaunch: depositors distribution</p>
            <p>Successfully launched: actual list of current holders</p>
          </div>
        </slot>
        <div
          class="i-mdi:information-outline text-gray-400 hover:text-white transition-colors"
        />
      </Tooltip>
    </h2>

    {#await holders}
      <div class="flex justify-center py-4">
        <div class="loader w-8 h-8" />
      </div>
    {:then holders}
      {#if holders === null || holders.length === 0}
        <div class="text-center text-gray-400 py-4">No holders yet</div>
      {:else}
        <div
          class="flex justify-between items-center mb-3 text-sm text-gray-400 px-2"
        >
          <span>Total Holders</span>
          <span>
            {holders.length >= 98 ? "100+" : holders.length}
          </span>
        </div>
        <div class="space-y-3">
          {#each holders as [address, percentage] (address)}
            <a
              href={`/profile/${address}`}
              class="flex items-center justify-between py-1 px-2 rounded hover:bg-gray-600/30"
            >
              <div class="flex items-center gap-2">
                {#if address === "pool" || address === "v2.ref-finance.near"}
                  <div class="i-mdi:pool text-shitzu-4" />
                {:else if address === "team" || address === import.meta.env.VITE_MEME_COOKING_CONTRACT_ID}
                  <div class="i-mdi:account-group text-shitzu-4" />
                {:else}
                  <img src={SHITZU_POCKET} alt="Account" class="size-4" />
                {/if}
                <span class="font-medium truncate max-w-[200px]">
                  {address}
                </span>
              </div>
              <span class="font-medium text-shitzu-4">
                {percentage}%
              </span>
            </a>
          {/each}
        </div>
      {/if}
    {/await}
  </div>
</div>
