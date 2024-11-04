<script lang="ts">
  import { onDestroy } from "svelte";
  import { derived } from "svelte/store";

  import FormatNumber from "./FormatNumber.svelte";
  import McIcon from "./MCIcon.svelte";

  import { refreshNearBalance, nearBalance } from "$lib/near";
  import { wallet } from "$lib/near/wallet";
  import { portfolio$, fetchPortfolio } from "$lib/store/portfolio";
  import type { Portfolio } from "$lib/store/portfolio";
  import { getNearPrice, nearPrice } from "$lib/util/projectedMCap";

  export let accountId: string;
  const { accountId$ } = wallet;

  refreshNearBalance(accountId);
  getNearPrice();

  const refreshInterval = setInterval(() => {
    refreshNearBalance(accountId);
    getNearPrice();
  }, 30e3);

  onDestroy(() => clearInterval(refreshInterval));

  let portfolio: Portfolio | null = null;
  const unsubscribe = derived([accountId$, portfolio$], ([$id, $p]) => ({
    accountId: $id,
    portfolio: $p,
  })).subscribe(({ accountId: curId, portfolio: curPortfolio }) => {
    if (curId === accountId) {
      portfolio = curPortfolio as Portfolio;
    } else {
      fetchPortfolio(accountId).then((r) => (portfolio = r));
    }
  });

  onDestroy(() => unsubscribe());
</script>

{#if portfolio}
  <div class="w-full overflow-x-auto">
    <table class="min-w-full table-auto">
      <thead class="text-xs uppercase bg-gray-800">
        <tr>
          <th class="p-2">Token</th>
          <th class="p-2">Balance</th>
          <th class="p-2">Price</th>
          <th class="p-2">Value</th>
        </tr>
      </thead>
      <tbody>
        {#if $nearBalance}
          <tr class="border-b border-gray-700">
            <td class="p-2 truncate max-w-[200px]">NEAR</td>
            <td class="p-2">{$nearBalance.format()}</td>
            <td class="p-2">${(Number($nearPrice) / 1e24).toFixed(10)}</td>
            <td class="p-2"
              >${(
                ($nearBalance.toNumber() * Number($nearPrice)) /
                1e24
              ).toFixed(2)}</td
            >
          </tr>
        {/if}
        {#each portfolio.tokens.sort((a, b) => {
          const [aD, bD] = [a.contract_id === "wrap.near" ? 24 : a.decimals ?? 18, b.contract_id === "wrap.near" ? 24 : b.decimals ?? 18];
          const [aB, bB] = [Number(a.balance) / 10 ** aD, Number(b.balance) / 10 ** bD];
          const [aP, bP] = [a.price ? (a.price * Number($nearPrice)) / 1e24 : 0, b.price ? (b.price * Number($nearPrice)) / 1e24 : 0];
          return bB * bP - aB * aP;
        }) as t}
          {@const d = t.contract_id === "wrap.near" ? 24 : t.decimals ?? 18}
          {@const bal = (+t.balance / 10 ** d).toFixed(4)}
          {@const p = t.price ? (t.price * Number($nearPrice)) / 1e24 : 0}
          {@const val = (p * Number(bal)).toFixed(2)}
          <tr class="border-b border-gray-700">
            <td class="p-2 truncate max-w-[200px]">
              {#if t.image}
                <div class="flex items-center gap-2">
                  <McIcon
                    meme={{ image: t.image, name: t.contract_id }}
                    class="w-6 h-6 rounded-full"
                  />
                  <span>{t.symbol || t.name || t.contract_id}</span>
                </div>
              {:else}
                {t.symbol || t.name || t.contract_id}
              {/if}
            </td>
            <td class="p-2">
              <FormatNumber number={Number(bal)} totalDigits={6} />
            </td>
            <td class="p-2">
              $<FormatNumber number={p} totalDigits={6} />
            </td>
            <td class="p-2">
              $<FormatNumber number={Number(val)} totalDigits={6} />
            </td>
          </tr>
        {/each}
        <tr class="bg-gray-800">
          <td colspan="3" class="p-2 font-medium">Total Value</td>
          <td class="p-2 font-medium">
            ${(
              (Number($nearBalance) * Number($nearPrice)) / 1e24 +
              portfolio.tokens.reduce((sum, t) => {
                const d = t.contract_id === "wrap.near" ? 24 : 18;
                return (
                  sum +
                  (Number(t.balance) / 10 ** d) *
                    (t.price ? t.price * Number($nearPrice) : 0)
                );
              }, 0)
            ).toFixed(2)}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
{:else}
  <div class="text-center py-4">Loading portfolio...</div>
{/if}
