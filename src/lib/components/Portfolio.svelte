<script lang="ts">
  import { onDestroy } from "svelte";
  import { get } from "svelte/store";

  import FormatNumber from "./FormatNumber.svelte";
  import McIcon from "./MCIcon.svelte";
  import LoadingLambo from "./memecooking/Board/LoadingLambo.svelte";
  import SendSheet from "./memecooking/BottomSheet/SendSheet.svelte";

  import Near from "$lib/assets/Near.svelte";
  import { openBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
  import { wallet } from "$lib/near";
  import type { Portfolio } from "$lib/store/portfolio";
  import type { FixedNumber } from "$lib/util";
  import { getNearPrice, nearPrice } from "$lib/util/projectedMCap";

  export let accountId: string;
  export let portfolio: Portfolio | null;
  export let nearBalance: FixedNumber | null;

  $: isOwnAccount = accountId === get(wallet.accountId$);

  getNearPrice();

  const refreshInterval = setInterval(() => {
    getNearPrice();
  }, 30e3);

  onDestroy(() => clearInterval(refreshInterval));
</script>

{#if portfolio}
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
              $<FormatNumber
                number={(Number($nearPrice) / 1e24) * 1e9}
                totalDigits={6}
              />
            </td>
          </tr>
        {/if}
        {#each portfolio.tokens
          .filter((t) => {
            const d = t.contract_id === "wrap.near" ? 24 : t.decimals ?? 18;
            const bal = Number(t.balance) / 10 ** d;
            const p = t.price ? (t.price * Number($nearPrice)) / 1e24 : 0;
            const val = bal * p;
            return val >= 0.0001; // Filter out tokens worth less than 1 cent
          })
          .sort((a, b) => {
            const [aD, bD] = [a.contract_id === "wrap.near" ? 24 : a.decimals ?? 18, b.contract_id === "wrap.near" ? 24 : b.decimals ?? 18];
            const [aB, bB] = [Number(a.balance) / 10 ** aD, Number(b.balance) / 10 ** bD];
            const [aP, bP] = [a.price ? (a.price * Number($nearPrice)) / 1e24 : 0, b.price ? (b.price * Number($nearPrice)) / 1e24 : 0];
            return bB * bP - aB * aP;
          }) as t, i}
          {@const d = t.contract_id === "wrap.near" ? 24 : t.decimals ?? 18}
          {@const bal = (+t.balance / 10 ** d).toFixed(4)}
          {@const p = t.price ? (t.price * Number($nearPrice)) / 1e24 : 0}
          {@const val = (p * Number(bal)).toFixed(2)}
          {@const mcap = t.total_supply
            ? p * (Number(t.total_supply) / 10 ** d)
            : 0}
          <tr
            class="{i % 2 === 0 ? 'bg-gray-700/20' : ''} hover:bg-gray-800/50"
          >
            <td class="px-4 py-3 truncate max-w-[200px]">
              {#if t.image}
                <a
                  href={`/meme/${t.meme_id && t.meme_id < 0 ? t.contract_id : t.meme_id}`}
                  class="flex items-center gap-3 hover:opacity-80 hover:text-shitzu-4"
                >
                  {#key t.image}
                    <McIcon
                      meme={{ image: t.image, name: t.contract_id }}
                      class="w-8 h-8 rounded-full"
                    />
                  {/key}
                  <div class="flex flex-col">
                    <span class="font-medium flex items-center gap-1">
                      {t.name || t.contract_id}
                      <span class="text-xs text-gray-400"
                        >({t.symbol || t.contract_id})</span
                      >
                    </span>
                    <span class="text-xs text-gray-400 sm:hidden"
                      >$<FormatNumber number={p} totalDigits={6} /></span
                    >
                    <span class="text-xs text-gray-400 hidden sm:block"
                      >{t.contract_id}</span
                    >
                  </div>
                </a>
              {:else}
                <div class="flex flex-col">
                  <span class="font-medium"
                    >{t.symbol || t.name || t.contract_id}</span
                  >
                  <span class="text-xs text-gray-400">${p.toFixed(4)}</span>
                </div>
              {/if}
            </td>
            <td class="px-4 py-3 text-right">
              <div class="flex flex-col items-end">
                <span class="font-medium"
                  ><FormatNumber number={Number(bal)} totalDigits={6} /></span
                >
                <span class="text-xs text-gray-400">${val}</span>
              </div>
            </td>
            <td class="hidden sm:table-cell px-4 py-3 text-right font-medium">
              $<FormatNumber number={p} totalDigits={6} />
            </td>
            <td class="hidden sm:table-cell px-4 py-3 text-right font-medium">
              {#if mcap}
                $<FormatNumber number={mcap} totalDigits={6} />
              {:else}
                <span class="text-gray-400">-</span>
              {/if}
            </td>
            {#if isOwnAccount}
              <td
                class="hidden sm:flex py-3 text-right flex-col items-center gap-1"
              >
                <button
                  class="px-1 py-1 bg-shitzu-4 hover:bg-shitzu-5 text-white rounded-md text-sm flex flex-col items-center gap-1"
                  on:click={() => {
                    openBottomSheet(SendSheet, { meme: t });
                  }}
                >
                  <div class="i-mdi:arrow-right" />
                </button>
                <span class="text-xs text-gray-400">send</span>
              </td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else}
  <div class="text-center py-8 text-white">
    <LoadingLambo />
  </div>
{/if}
