<script lang="ts">
  import type { CreateQueryResult } from "@tanstack/svelte-query";
  import { onDestroy } from "svelte";
  import { get } from "svelte/store";

  import FormatNumber from "./FormatNumber.svelte";
  import PortfolioRow from "./PortfolioRow.svelte";
  import LoadingLambo from "./memecooking/Board/LoadingLambo.svelte";

  import type { Portfolio } from "$lib/api/queries/portfolio";
  import Near from "$lib/assets/Near.svelte";
  import { nearWallet } from "$lib/near";
  import { FixedNumber } from "$lib/util";
  import { getNearPrice, nearPrice } from "$lib/util/projectedMCap";

  export let accountId: string;
  export let portfolio: Portfolio | null;
  export let nearBalance: FixedNumber | null;
  export let portfolioQuery: CreateQueryResult<Portfolio, Error>;

  $: isOwnAccount = accountId === get(nearWallet.accountId$);

  getNearPrice();

  const refreshInterval = setInterval(() => {
    getNearPrice();
  }, 30e3);

  onDestroy(() => clearInterval(refreshInterval));
</script>

{#if $portfolioQuery.isLoading}
  <div class="text-center py-8 text-white">
    <LoadingLambo />
  </div>
{:else if $portfolioQuery.isError}
  <div class="text-center py-8 text-red-500">
    Error loading portfolio: {$portfolioQuery.error.message}
  </div>
{:else if portfolio}
  <div
    class="w-full overflow-x-auto rounded-lg bg-gray-800 border border-gray-800 my-4"
  >
    <table class="min-w-full table-auto">
      <thead>
        <tr class="text-xs uppercase text-gray-400 border-b border-gray-800">
          <th class="px-4 py-3 text-left">Token</th>
          <th class="px-4 py-3 text-right">Balance</th>
          <th class="hidden sm:table-cell px-4 py-3 text-right">Price</th>
          <th class="hidden sm:table-cell px-4 py-3 text-right">Market Cap</th>
          {#if isOwnAccount}
            <th class="hidden sm:table-cell px-4 py-3 text-right">Action</th>
          {/if}
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-700">
        {#if nearBalance}
          <tr class="bg-gray-800/20 hover:bg-gray-800/50 transition-colors">
            <td class="px-4 py-3 truncate max-w-[200px]">
              <div class="flex items-center gap-3">
                <Near
                  className="w-8 h-8 rounded-full bg-white text-black p-1"
                />
                <div class="flex flex-col">
                  <span class="font-medium">NEAR</span>
                  <span class="text-xs text-gray-400 sm:hidden"
                    >$<FormatNumber
                      number={Number($nearPrice) / 1e24}
                      totalDigits={6}
                    /></span
                  >
                </div>
              </div>
            </td>
            <td class="px-4 py-3 text-right">
              <div class="flex flex-col items-end">
                <span class="font-medium">{nearBalance.format()}</span>
                <span class="text-xs text-gray-400"
                  >${(
                    (nearBalance.toNumber() * Number($nearPrice)) /
                    1e24
                  ).toFixed(2)}</span
                >
              </div>
            </td>
            <td class="hidden sm:table-cell px-4 py-3 text-right font-medium"
              >${(Number($nearPrice) / 1e24).toFixed(10)}</td
            >
            <td class="hidden sm:table-cell px-4 py-3 text-right font-medium">
              <!-- $<FormatNumber
                number={(Number($nearPrice) / 1e24) * 1e9}
                totalDigits={6}
              /> -->
            </td>
          </tr>
        {/if}
        {#each portfolio.tokens
          .filter((t) => {
            const decimals = t.decimals ?? 24;
            const balance = new FixedNumber(t.balance, decimals);
            const price = t.price ? new FixedNumber(BigInt(Math.round(t.price * 1e24)), 24) : null;
            const nearPriceFixed = new FixedNumber($nearPrice, 24);

            const value = price ? balance
                  .mul(price)
                  .mul(nearPriceFixed)
                  .toNumber() : 0;

            return value >= 0.0001;
          })
          .sort((a, b) => {
            const aDecimals = a.decimals ?? 24;
            const bDecimals = b.decimals ?? 24;

            const aBalance = new FixedNumber(a.balance, aDecimals);
            const bBalance = new FixedNumber(b.balance, bDecimals);

            const aPrice = a.price ? new FixedNumber(BigInt(Math.round(a.price * 1e24)), 24) : new FixedNumber("0", 24);
            const bPrice = b.price ? new FixedNumber(BigInt(Math.round(b.price * 1e24)), 24) : new FixedNumber("0", 24);

            const nearPriceFixed = new FixedNumber($nearPrice, 24);

            const aValue = aBalance.mul(aPrice).mul(nearPriceFixed).toNumber();
            const bValue = bBalance.mul(bPrice).mul(nearPriceFixed).toNumber();

            return bValue - aValue;
          }) as t, i}
          <PortfolioRow
            token={t}
            {isOwnAccount}
            index={i}
            nearPrice={new FixedNumber($nearPrice, 24)}
          />
        {/each}
      </tbody>
    </table>
  </div>
{:else}
  <div class="text-center py-8 text-white">No portfolio data available</div>
{/if}
